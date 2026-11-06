package com.web.SearchWeb.folder.controller.dto;

import com.web.SearchWeb.folder.domain.MemberFolder;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MemberFolderResponses {
    private final Long memberFolderId;
    private final Long ownerMemberId;
    private final Long parentFolderId;
    private final String folderName;
    private final String description;
    private final String folderType;
    private final Integer bookmarkCount;
    private final boolean pinned;

    // Entity -> DTO 변환을 위한 정적 팩토리 메서드
    public static MemberFolderResponses from(MemberFolder folder) {
        return MemberFolderResponses.builder()
            .memberFolderId(folder.getMemberFolderId())
            .ownerMemberId(folder.getOwnerMemberId())
            .parentFolderId(folder.getParentFolderId())
            .folderName(folder.getFolderName())
            .description(folder.getDescription())
            .folderType(folder.getFolderType().name())
            .bookmarkCount(folder.getBookmarkCount())
            .pinned(folder.isPinned())
            .build();
    }
}
