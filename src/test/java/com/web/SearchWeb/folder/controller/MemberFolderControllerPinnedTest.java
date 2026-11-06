package com.web.SearchWeb.folder.controller;

import com.web.SearchWeb.config.common.ApiResponse;
import com.web.SearchWeb.folder.controller.dto.MemberFolderRequests;
import com.web.SearchWeb.folder.controller.dto.MemberFolderResponses;
import com.web.SearchWeb.folder.domain.FolderType;
import com.web.SearchWeb.folder.domain.MemberFolder;
import com.web.SearchWeb.folder.service.MemberFolderService;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** DB 미접속 컨트롤러 단위 테스트: Pinned 요청 매핑·기본값·응답 변환만 확인한다. */
@ExtendWith(MockitoExtension.class)
class MemberFolderControllerPinnedTest {
    @Mock MemberFolderService service;
    MemberFolderController controller;

    @BeforeEach void setup() { controller = new MemberFolderController(service); }

    private MemberFolder folder(long id, FolderType type, boolean pinned) {
        return MemberFolder.builder().memberFolderId(id).ownerMemberId(1L).folderName("F" + id)
            .folderType(type).pinned(pinned).build();
    }

    private MemberFolderRequests.Create create(Boolean pinned) {
        MemberFolderRequests.Create req = new MemberFolderRequests.Create();
        req.folderName = "New";
        req.pinned = pinned;
        return req;
    }

    @Test void createDefaultsPinnedOffWhenOmitted() {
        when(service.create(1L, null, "New", null, false)).thenReturn(10L);
        ResponseEntity<ApiResponse<Long>> res = controller.create(1L, create(null));
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(res.getBody().getData()).isEqualTo(10L);
        verify(service).create(1L, null, "New", null, false);
    }

    @Test void createPassesPinnedTrueInSameRequest() {
        when(service.create(1L, null, "New", null, true)).thenReturn(11L);
        controller.create(1L, create(true));
        verify(service).create(1L, null, "New", null, true);
    }

    @Test void patchPassesTargetValueAndReturnsFolderState() {
        when(service.setPinned(1L, 5L, false)).thenReturn(folder(5L, FolderType.UNORGANIZED, false));
        MemberFolderRequests.Pin req = new MemberFolderRequests.Pin();
        req.pinned = false;
        ResponseEntity<ApiResponse<MemberFolderResponses>> res = controller.setPinned(1L, 5L, req);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody().getData().getMemberFolderId()).isEqualTo(5L);
        assertThat(res.getBody().getData().isPinned()).isFalse();
        verify(service).setPinned(1L, 5L, false);
    }

    @Test void pinnedListUsesCurrentMemberAndKeepsOrder() {
        when(service.listPinned(1L)).thenReturn(List.of(folder(3L, FolderType.CUSTOM, true),
            folder(4L, FolderType.UNORGANIZED, true)));
        ResponseEntity<ApiResponse<List<MemberFolderResponses>>> res = controller.listPinned(1L);
        assertThat(res.getBody().getData()).extracting(MemberFolderResponses::getMemberFolderId)
            .containsExactly(3L, 4L);
        assertThat(res.getBody().getData()).allMatch(MemberFolderResponses::isPinned);
        verify(service).listPinned(1L);
    }
}
