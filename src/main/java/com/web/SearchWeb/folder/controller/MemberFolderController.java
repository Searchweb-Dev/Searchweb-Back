package com.web.SearchWeb.folder.controller;

import com.web.SearchWeb.config.common.ApiResponse;
import com.web.SearchWeb.config.security.CurrentMemberId;
import com.web.SearchWeb.folder.controller.dto.MemberFolderRequests;
import com.web.SearchWeb.folder.controller.dto.MemberFolderResponses;
import com.web.SearchWeb.folder.domain.MemberFolder;
import com.web.SearchWeb.folder.error.FolderErrorCode;
import com.web.SearchWeb.folder.service.MemberFolderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/folders")
public class MemberFolderController {

    private final MemberFolderService memberFolderService;

    // 생성 (201 Created 응답)
    @PostMapping
    public ResponseEntity<ApiResponse<Long>> create(@CurrentMemberId Long memberId, @Valid @RequestBody MemberFolderRequests.Create req) {
        Long folderId = memberFolderService.create(
            memberId,
            req.parentFolderId,
            req.folderName,
            req.description,
            Boolean.TRUE.equals(req.pinned)
        );
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse.success(folderId));
    }

    // 내 루트 폴더 목록 조회
    @GetMapping("/me/root")
    public ResponseEntity<ApiResponse<List<MemberFolderResponses>>> listMyRoot(@CurrentMemberId Long memberId) {
        List<MemberFolderResponses> responses = memberFolderService.listRootFolders(memberId, memberId)
            .stream()
            .map(MemberFolderResponses::from)
            .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    // 현재 회원의 고정된 루트 폴더 목록 조회
    @GetMapping("/me/pinned")
    public ResponseEntity<ApiResponse<List<MemberFolderResponses>>> listPinned(@CurrentMemberId Long memberId) {
        return ResponseEntity.ok(ApiResponse.success(memberFolderService.listPinned(memberId).stream()
            .map(MemberFolderResponses::from).collect(Collectors.toList())));
    }

    // 폴더 고정 상태 변경
    @PatchMapping("/{folderId}/pinned")
    public ResponseEntity<ApiResponse<MemberFolderResponses>> setPinned(@CurrentMemberId Long memberId,
        @PathVariable Long folderId, @Valid @RequestBody MemberFolderRequests.Pin req) {
        return ResponseEntity.ok(ApiResponse.success(MemberFolderResponses.from(
            memberFolderService.setPinned(memberId, folderId, req.pinned))));
    }

    // 폴더 정보 단건 조회
    @GetMapping("/{folderId}")
    public ResponseEntity<ApiResponse<MemberFolderResponses>> get(@CurrentMemberId Long memberId, @PathVariable Long folderId) {
        MemberFolder folder = memberFolderService.get(memberId, folderId);
        return ResponseEntity.ok(ApiResponse.success(MemberFolderResponses.from(folder)));
    }

    // 루트 폴더 조회
    @GetMapping("/owners/{ownerMemberId}/root")
    public ResponseEntity<ApiResponse<List<MemberFolderResponses>>> listRoot(
        @CurrentMemberId Long memberId,
        @PathVariable Long ownerMemberId
    ) {
        List<MemberFolderResponses> responses = memberFolderService.listRootFolders(memberId, ownerMemberId)
            .stream()
            .map(MemberFolderResponses::from)
            .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    // 하위 폴더 조회
    @GetMapping("/owners/{ownerMemberId}/children/{parentFolderId}")
    public ResponseEntity<ApiResponse<List<MemberFolderResponses>>> listChildren(
        @CurrentMemberId Long memberId,
        @PathVariable Long ownerMemberId,
        @PathVariable Long parentFolderId
    ) {
        List<MemberFolderResponses> responses = memberFolderService.listChildren(memberId, ownerMemberId, parentFolderId)
            .stream()
            .map(MemberFolderResponses::from)
            .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    // 수정 (200 OK)
    @PutMapping("/{folderId}")
    public ResponseEntity<ApiResponse<Void>> update(@CurrentMemberId Long memberId, @PathVariable Long folderId,
        @Valid @RequestBody MemberFolderRequests.Update req) {
        memberFolderService.update(memberId, folderId, req.folderName, req.description);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // 이동(부모 변경)
    @PutMapping("/{folderId}/move")
    public ResponseEntity<ApiResponse<Void>> move(@CurrentMemberId Long memberId, @PathVariable Long folderId,
        @Valid @RequestBody MemberFolderRequests.Move req) {
        memberFolderService.move(memberId, folderId, req.newParentFolderId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // 삭제
    @DeleteMapping("/{folderId}")
    public ResponseEntity<ApiResponse<Void>> delete(@CurrentMemberId Long memberId, @PathVariable Long folderId) {
        memberFolderService.delete(memberId, folderId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // 요청 본문 검증 실패(@Valid)와 읽을 수 없는 JSON(형식·타입 오류)만 400으로 응답한다.
    // 이 컨트롤러에만 적용되며 전역 예외 처리(GlobalExceptionHandler)와 다른 API는 변경하지 않는다.
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ApiResponse<Void>> handleInvalidRequest(Exception e) {
        log.warn("Invalid folder request: {}", e.getClass().getSimpleName());
        return ResponseEntity
            .status(FolderErrorCode.INVALID_FOLDER_REQUEST.getStatus())
            .body(ApiResponse.fail(FolderErrorCode.INVALID_FOLDER_REQUEST));
    }
}
