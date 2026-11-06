package com.web.SearchWeb.folder.service;

import com.web.SearchWeb.folder.domain.MemberFolder;
import java.util.List;

public interface MemberFolderService {

    Long create(Long memberId, Long parentFolderId, String folderName, String description);
    Long create(Long memberId, Long parentFolderId, String folderName, String description, boolean pinned);
    MemberFolder setPinned(Long memberId, Long folderId, boolean pinned);
    List<MemberFolder> listPinned(Long memberId);

    MemberFolder get(Long memberId, Long memberFolderId);

    List<MemberFolder> listRootFolders(Long memberId, Long ownerMemberId);

    List<MemberFolder> listChildren(Long memberId, Long ownerMemberId, Long parentFolderId);

    void update(Long memberId, Long memberFolderId, String folderName, String description);

    void move(Long memberId, Long memberFolderId, Long newParentFolderId);

    void delete(Long memberId, Long memberFolderId);

    /** 없으면 생성하고, 있으면 기존 ID를 반환. idempotent. (미분류(UNORGANIZED) 폴더를 보장) */
    Long getOrCreateUnorganizedFolderId(Long memberId);

    /** 활성 루트 폴더를 이름 기준(대소문자 무시)으로 재사용하고, 없으면 현재 트랜잭션에서 생성. */
    Long getOrCreateRootFolderIdIgnoreCase(Long memberId, String folderName);

    /** 미분류 폴더를 단건으로 반환한다. 없으면 getOrCreate 경로로 생성 후 반환. */
    MemberFolder getDefaultFolder(Long memberId);
}
