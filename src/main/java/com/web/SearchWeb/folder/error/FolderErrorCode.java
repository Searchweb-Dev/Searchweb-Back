package com.web.SearchWeb.folder.error;

import com.web.SearchWeb.config.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum FolderErrorCode implements ErrorCode {
    FOLDER_NOT_FOUND(HttpStatus.NOT_FOUND, "F001", "폴더를 찾을 수 없습니다."),
    DUPLICATE_FOLDER_NAME(HttpStatus.BAD_REQUEST, "F002", "이미 존재하는 폴더명입니다."),
    FOLDER_FORBIDDEN(HttpStatus.FORBIDDEN,"F003" ,"접근이 제한된 폴더입니다." ),
    INVALID_FOLDER_NAME(HttpStatus.BAD_REQUEST,"F004","폴더명으로 적절하지 않습니다" ),
    INVALID_FOLDER_MOVE(HttpStatus.BAD_REQUEST, "F005", "유효하지 않은 폴더 이동입니다."),
    FOLDER_NOT_EMPTY(HttpStatus.BAD_REQUEST, "F006", "하위 폴더 또는 북마크가 남아 있어 삭제할 수 없습니다."),
    SYSTEM_FOLDER_IMMUTABLE(HttpStatus.CONFLICT, "F007", "기본 폴더는 삭제하거나 이동할 수 없습니다."),
    DEFAULT_FOLDER_NAME_CONFLICT(HttpStatus.CONFLICT, "F008", "같은 이름의 폴더가 이미 존재하여 기본 폴더를 생성할 수 없습니다."),
    INVALID_PIN_TARGET(HttpStatus.BAD_REQUEST, "F009", "고정할 수 없는 폴더입니다."),
    INVALID_FOLDER_REQUEST(HttpStatus.BAD_REQUEST, "F010", "요청 값이 올바르지 않습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
