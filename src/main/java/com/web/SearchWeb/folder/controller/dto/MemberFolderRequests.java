package com.web.SearchWeb.folder.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

public class MemberFolderRequests {

    /**
     * 폴더 생성 요청
     */

    @Getter
    @NoArgsConstructor
    public static class Create {
        // null이면 루트 폴더
        @Positive(message = "parentFolderId는 양수여야 합니다.")
        public Long parentFolderId;

        @NotBlank(message = "folderName은 비어 있을 수 없습니다.")
        @Size(max = 50, message = "folderName은 최대 50자까지 가능합니다.")
        public String folderName;

        @Size(max = 200, message = "description은 최대 200자까지 가능합니다.")
        public String description;
        public Boolean pinned;
    }

    /**
     * 폴더 수정 요청
     */
    @Getter
    @NoArgsConstructor
    public static class Update {
        @Size(max = 50, message = "folderName은 최대 50자까지 가능합니다.")
        public String folderName;

        @Size(max = 200, message = "description은 최대 200자까지 가능합니다.")
        public String description;
    }

    /**
     * 폴더 이동 요청
     */
    @Getter
    @NoArgsConstructor
    public static class Move {
        // null이면 루트로 이동
        @Positive(message = "newParentFolderId는 양수여야 합니다.")
        public Long newParentFolderId;
    }

    /**
     * 폴더 고정 상태 변경 요청
     */
    @Getter
    @NoArgsConstructor
    public static class Pin {
        @jakarta.validation.constraints.NotNull
        public Boolean pinned;
    }
}
