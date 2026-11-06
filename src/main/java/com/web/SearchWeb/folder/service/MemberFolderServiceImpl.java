package com.web.SearchWeb.folder.service;

import com.web.SearchWeb.bookmark.dao.BookmarkDao;
import com.web.SearchWeb.folder.dao.MemberFolderJpaDao;
import com.web.SearchWeb.folder.domain.FolderType;
import com.web.SearchWeb.folder.domain.MemberFolder;
import com.web.SearchWeb.folder.error.FolderErrorCode;
import com.web.SearchWeb.folder.error.FolderException;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemberFolderServiceImpl implements MemberFolderService {

    private static final String UNORGANIZED_FOLDER_NAME = "미분류";

    private final MemberFolderJpaDao memberFolderJpaRepository;
    private final BookmarkDao bookmarkDao;
    private MemberFolderService self;

    @Autowired
    public void setSelf(@Lazy MemberFolderService self) {
        this.self = self;
    }

    @Override
    @Transactional
    public Long create(Long memberId, Long parentFolderId, String folderName, String description) {
        return create(memberId, parentFolderId, folderName, description, false);
    }

    @Override
    @Transactional
    public Long create(Long memberId, Long parentFolderId, String folderName, String description, boolean pinned) {
        if (pinned && parentFolderId != null) throw new FolderException(FolderErrorCode.INVALID_PIN_TARGET);
        String normalizedFolderName = normalizeFolderName(folderName);
        String normalizedDescription = normalizeDescription(description);

        // 1. 부모 폴더가 있는 경우 검증
        if (parentFolderId != null) {
            MemberFolder parentFolder = memberFolderJpaRepository
                .findByIdForUpdate(parentFolderId)
                .orElseThrow(() -> new FolderException(FolderErrorCode.FOLDER_NOT_FOUND));

            // 2. 부모 폴더 소유자 검증
            if (!parentFolder.getOwnerMemberId().equals(memberId)) {
                throw new FolderException(FolderErrorCode.FOLDER_FORBIDDEN);
            }

            // 3. 같은 부모 아래 동일 이름 폴더 중복 검증
            boolean exists = memberFolderJpaRepository
                .existsByOwnerMemberIdAndParentFolderIdAndFolderName(
                    memberId, parentFolderId, normalizedFolderName
                );

            if (exists) {
                throw new FolderException(FolderErrorCode.DUPLICATE_FOLDER_NAME);
            }
        } else {
            // 4. 루트 폴더 생성은 이름변경/루트 이동과 동일한 대소문자 무시 규칙을 사용합니다.
            validateUniqueRootFolderName(memberId, normalizedFolderName, null);
        }

        MemberFolder folder = MemberFolder.builder()
            .ownerMemberId(memberId)
            .parentFolderId(parentFolderId)
            .folderName(normalizedFolderName)
            .description(normalizedDescription)
            .createdByMemberId(memberId)
            .pinned(pinned)
            .build();

        return memberFolderJpaRepository.save(folder).getMemberFolderId();
    }

    @Override
    @Transactional
    public MemberFolder setPinned(Long memberId, Long folderId, boolean pinned) {
        MemberFolder folder = memberFolderJpaRepository.findByIdForUpdate(folderId)
            .orElseThrow(() -> new FolderException(FolderErrorCode.FOLDER_NOT_FOUND));
        if (folder.isDeleted()) throw new FolderException(FolderErrorCode.FOLDER_NOT_FOUND);
        validateOwner(memberId, folder.getOwnerMemberId());
        if (folder.getParentFolderId() != null ||
            !(folder.getFolderType() == FolderType.CUSTOM || folder.getFolderType() == FolderType.UNORGANIZED)) {
            throw new FolderException(FolderErrorCode.INVALID_PIN_TARGET);
        }
        folder.setPinned(pinned);
        return folder;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MemberFolder> listPinned(Long memberId) {
        return listRootFolders(memberId, memberId).stream()
            .filter(MemberFolder::isPinned)
            .filter(f -> f.getFolderType() == FolderType.CUSTOM || f.getFolderType() == FolderType.UNORGANIZED)
            .collect(Collectors.toList());
    }

    private String normalizeFolderName(String folderName) {
        if (folderName == null) {
            throw new FolderException(FolderErrorCode.INVALID_FOLDER_NAME);
        }

        String normalizedFolderName = folderName.trim();
        if (normalizedFolderName.isEmpty() || normalizedFolderName.length() > 50) {
            throw new FolderException(FolderErrorCode.INVALID_FOLDER_NAME);
        }

        if (UNORGANIZED_FOLDER_NAME.equalsIgnoreCase(normalizedFolderName)) {
            throw new FolderException(FolderErrorCode.INVALID_FOLDER_NAME);
        }

        return normalizedFolderName;
    }

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }

        String normalizedDescription = description.trim();
        if (normalizedDescription.isEmpty()) {
            return null;
        }

        return normalizedDescription;
    }

    /**
     * 최상위(루트) 폴더명이 대소문자 구분 없이 중복되는지 검사.
     * (동시 생성 방지용 락 적용 / 본인 폴더의 대소문자 변경은 허용)
     */
    private void validateUniqueRootFolderName(
        Long memberId,
        String folderName,
        Long excludedMemberFolderId
    ) {
        // 동시성 대비 회원별 루트 폴더 락 획득
        memberFolderJpaRepository.lockRootFolderNamespace(memberId);

        // 신규 생성(ID 없음) vs 수정·이동(ID 있음) 분기 검사
        boolean exists = excludedMemberFolderId == null
            ? memberFolderJpaRepository
                // [신규 생성인 경우] 대소문자 구분 없이 동일한 이름의 루트 폴더 존재 확인
                .findFirstByOwnerMemberIdAndParentFolderIdIsNullAndFolderNameIgnoreCaseAndDeletedAtIsNull(
                    memberId,
                    folderName
                )
                .isPresent()
            : memberFolderJpaRepository
                // [수정/이동인 경우] 자신(ID)을 제외하고 대소문자 구분 없이 동일한 이름 존재 확인
                .existsActiveRootFolderNameIgnoreCaseExcludingId(
                    memberId,
                    folderName,
                    excludedMemberFolderId
                );

        // 이름 중복 시 예외 발생
        if (exists) {
            throw new FolderException(FolderErrorCode.DUPLICATE_FOLDER_NAME);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MemberFolder get(Long memberId, Long memberFolderId) {
        return getOwnedFolder(memberId, memberFolderId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MemberFolder> listRootFolders(Long memberId, Long ownerMemberId) {
        validateOwner(memberId, ownerMemberId);
        // 기존 회원 대상 lazy 백필: 조회 호출 시 미분류 폴더가 없으면 이 시점에 생성
        if (!memberFolderJpaRepository.existsByOwnerMemberIdAndFolderType(ownerMemberId, FolderType.UNORGANIZED)) {
            self.getOrCreateUnorganizedFolderId(ownerMemberId);
        }
        return memberFolderJpaRepository.findAllByOwnerMemberIdAndParentFolderIdIsNull(ownerMemberId)
            .stream()
            .filter(f -> !f.isDeleted())
            .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<MemberFolder> listChildren(Long memberId, Long ownerMemberId, Long parentFolderId) {
        validateOwner(memberId, ownerMemberId);
        MemberFolder parentFolder = getOwnedFolder(memberId, parentFolderId);
        if (!parentFolder.getOwnerMemberId().equals(ownerMemberId)) {
            throw new FolderException(FolderErrorCode.FOLDER_FORBIDDEN);
        }
        return memberFolderJpaRepository.findAllByOwnerMemberIdAndParentFolderId(ownerMemberId, parentFolderId)
            .stream()
            .filter(f -> !f.isDeleted())
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void update(Long memberId, Long memberFolderId, String folderName, String description) {

        // 폴더 소유권 확인 및 조회
        MemberFolder folder = getOwnedFolder(memberId, memberFolderId);

        // 입력값 검증 및 정규화 (null일 경우 기존 값 유지)
        String resolvedFolderName = folderName == null ? folder.getFolderName() : normalizeFolderName(folderName);
        String resolvedDescription = description == null ? folder.getDescription() : normalizeDescription(description);

        // 폴더명 변경 시 중복 검사
        if (!folder.getFolderName().equals(resolvedFolderName)) {
            // 루트 폴더인 경우
            if (folder.getParentFolderId() == null) {
                // 루트 폴더명 중복 검사
                validateUniqueRootFolderName(folder.getOwnerMemberId(), resolvedFolderName, folder.getMemberFolderId());
            // 하위 폴더인 경우
            } else {
                // 동일 부모 폴더 내 하위 폴더명 중복 검사
                boolean exists = memberFolderJpaRepository
                    .existsByOwnerMemberIdAndParentFolderIdAndFolderName(
                        folder.getOwnerMemberId(),
                        folder.getParentFolderId(),
                        resolvedFolderName
                    );

                if (exists) {
                    throw new FolderException(FolderErrorCode.DUPLICATE_FOLDER_NAME);
                }
            }
        }

        // 폴더 정보 업데이트
        folder.changeInfo(resolvedFolderName, resolvedDescription);
    }

    @Override
    @Transactional
    public void move(Long memberId, Long memberFolderId, Long newParentFolderId) {
        MemberFolder folder = getOwnedFolder(memberId, memberFolderId);

        if (folder.isUnorganized()) {
            throw new FolderException(FolderErrorCode.SYSTEM_FOLDER_IMMUTABLE);
        }

        if ((folder.getParentFolderId() == null && newParentFolderId == null)
            || (folder.getParentFolderId() != null && folder.getParentFolderId().equals(newParentFolderId))) {
            return;
        }

        if (newParentFolderId != null) {
            if (memberFolderId.equals(newParentFolderId)) {
                throw new FolderException(FolderErrorCode.INVALID_FOLDER_MOVE);
            }

            MemberFolder newParentFolder = getOwnedFolder(memberId, newParentFolderId);

            if (!newParentFolder.getOwnerMemberId().equals(folder.getOwnerMemberId())) {
                throw new FolderException(FolderErrorCode.FOLDER_FORBIDDEN);
            }

            validateNoCycle(folder.getMemberFolderId(), newParentFolder);

            boolean exists = memberFolderJpaRepository.existsByOwnerMemberIdAndParentFolderIdAndFolderName(
                folder.getOwnerMemberId(),
                newParentFolderId,
                folder.getFolderName()
            );
            if (exists) {
                throw new FolderException(FolderErrorCode.DUPLICATE_FOLDER_NAME);
            }
        } else {
            validateUniqueRootFolderName(
                folder.getOwnerMemberId(),
                folder.getFolderName(),
                folder.getMemberFolderId()
            );
        }

        folder.changeParent(newParentFolderId);
    }

    @Override
    @Transactional
    public void delete(Long memberId, Long memberFolderId) {
        // 비관적 락(PESSIMISTIC_WRITE)을 걸어 동시 생성과의 레이스를 차단
        MemberFolder folder = memberFolderJpaRepository.findByIdForUpdate(memberFolderId)
            .orElseThrow(() -> new FolderException(FolderErrorCode.FOLDER_NOT_FOUND));

        if (folder.isDeleted()) {
            throw new FolderException(FolderErrorCode.FOLDER_NOT_FOUND);
        }

        validateOwner(memberId, folder.getOwnerMemberId());

        if (folder.isUnorganized()) {
            throw new FolderException(FolderErrorCode.SYSTEM_FOLDER_IMMUTABLE);
        }

        // 재귀적으로 폴더 및 북마크 삭제 수행
        deleteRecursive(memberId, folder);
    }

    /**
     * 폴더와 그 하위 모든 폴더 및 북마크를 재귀적으로 논리 삭제(Soft Delete)합니다.
     */
    private void deleteRecursive(Long memberId, MemberFolder folder) {
        Long folderId = folder.getMemberFolderId();

        // 1. 하위 폴더 조회 및 재귀 삭제 (비관적 락 적용하여 삭제 도중 하위 폴더 추가 차단)
        List<MemberFolder> children = memberFolderJpaRepository
            .findAllByOwnerMemberIdAndParentFolderIdForUpdate(memberId, folderId);
        
        for (MemberFolder child : children) {
            deleteRecursive(memberId, child);
        }

        // 2. 현재 폴더 내의 모든 북마크 및 태그 연결 논리 삭제
        bookmarkDao.deleteBookmarkTagsInFolder(memberId, folderId);
        bookmarkDao.deleteBookmarksInFolder(memberId, folderId);

        // 3. 현재 폴더 논리 삭제
        folder.softDelete(memberId);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Long getOrCreateUnorganizedFolderId(Long memberId) {
        // 같은 회원의 모든 루트 폴더 생성과 직렬화한 뒤, 잠금 획득 후 상태를 다시 확인합니다.
        memberFolderJpaRepository.lockRootFolderNamespace(memberId);

        // 1. 이미 시스템 폴더가 존재하면 해당 ID 반환 (idempotent)
        Optional<MemberFolder> existing = memberFolderJpaRepository
            .findFirstByOwnerMemberIdAndFolderType(memberId, FolderType.UNORGANIZED);
        if (existing.isPresent()) {
            return existing.get().getMemberFolderId();
        }

        // 2. 이름("미분류")이 루트에 이미 있으면 그 커스텀 폴더를 시스템 폴더로 전환
        Optional<MemberFolder> sameName = memberFolderJpaRepository
            .findFirstByOwnerMemberIdAndParentFolderIdIsNullAndFolderName(memberId, UNORGANIZED_FOLDER_NAME);
        if (sameName.isPresent()) {
            MemberFolder existingFolder = sameName.get();
            existingFolder.markAsUnorganized();
            return memberFolderJpaRepository.save(existingFolder).getMemberFolderId();
        }

        // 3. 신규 생성. 락은 트랜잭션 종료까지 유지되므로 같은 회원의 동시 생성이 여기까지 진입하지 않습니다.
        MemberFolder newFolder = MemberFolder.builder()
            .ownerMemberId(memberId)
            .folderName(UNORGANIZED_FOLDER_NAME)
            .folderType(FolderType.UNORGANIZED)
            .build();
        return memberFolderJpaRepository.save(newFolder).getMemberFolderId();
    }

    /**
     * 대소문자 구분 없이 기존에 존재하는 루트 폴더를 재사용하고,
     * 없으면 현재 트랜잭션 내에서 새 루트 폴더를 안전하게 생성(Idempotent)하여 ID를 반환.
     */
    @Override
    @Transactional
    public Long getOrCreateRootFolderIdIgnoreCase(Long memberId, String folderName) {

        // 예약어 "미분류" 입력 시 시스템 미분류 폴더 ID 조회로 우회
        if (folderName != null && UNORGANIZED_FOLDER_NAME.equalsIgnoreCase(folderName.trim())) {
            return getOrCreateUnorganizedFolderId(memberId);
        }

        // 폴더 이름 정규화
        String normalizedFolderName = normalizeFolderName(folderName);

        // 동시 생성 방지를 위해 Lock을 먼저 획득
        memberFolderJpaRepository.lockRootFolderNamespace(memberId);

        // 대소문자 무시 검색하여 기존 폴더가 존재하면 재사용
        Optional<MemberFolder> existing = memberFolderJpaRepository
            .findFirstByOwnerMemberIdAndParentFolderIdIsNullAndFolderNameIgnoreCaseAndDeletedAtIsNull(
                memberId,
                normalizedFolderName
            );

        // 기존 폴더가 존재하면 해당 ID 반환
        if (existing.isPresent()) {
            return existing.get().getMemberFolderId();
        }

        // 기존 폴더가 없는 경우 신규 루트 폴더 생성
        MemberFolder newFolder = MemberFolder.builder()
            .ownerMemberId(memberId)
            .parentFolderId(null)
            .folderName(normalizedFolderName)
            .createdByMemberId(memberId)
            .build();
        return memberFolderJpaRepository.save(newFolder).getMemberFolderId();
    }

    @Override
    @Transactional
    public MemberFolder getDefaultFolder(Long memberId) {
        Long id = getOrCreateUnorganizedFolderId(memberId);
        return memberFolderJpaRepository.findById(id)
            .orElseThrow(() -> new FolderException(FolderErrorCode.FOLDER_NOT_FOUND));
    }

    private MemberFolder getOwnedFolder(Long memberId, Long memberFolderId) {
        MemberFolder folder = memberFolderJpaRepository.findById(memberFolderId)
            .orElseThrow(() -> new FolderException(FolderErrorCode.FOLDER_NOT_FOUND));

        if (folder.isDeleted()) {
            throw new FolderException(FolderErrorCode.FOLDER_NOT_FOUND);
        }

        validateOwner(memberId, folder.getOwnerMemberId());
        return folder;
    }

    private void validateOwner(Long memberId, Long ownerMemberId) {
        if (!ownerMemberId.equals(memberId)) {
            throw new FolderException(FolderErrorCode.FOLDER_FORBIDDEN);
        }
    }

    private void validateNoCycle(Long folderId, MemberFolder parentFolder) {
        MemberFolder current = parentFolder;
        while (current != null) {
            if (current.getMemberFolderId().equals(folderId)) {
                throw new FolderException(FolderErrorCode.INVALID_FOLDER_MOVE);
            }

            Long nextParentId = current.getParentFolderId();
            if (nextParentId == null) {
                return;
            }

            current = memberFolderJpaRepository.findById(nextParentId)
                .orElseThrow(() -> new FolderException(FolderErrorCode.FOLDER_NOT_FOUND));
        }
    }
}
