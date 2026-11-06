package com.web.SearchWeb.folder.controller;

import com.web.SearchWeb.config.jwt.JwtMemberPrincipal;
import com.web.SearchWeb.config.security.CurrentMemberIdArgumentResolver;
import com.web.SearchWeb.config.security.GlobalExceptionHandler;
import com.web.SearchWeb.folder.domain.FolderType;
import com.web.SearchWeb.folder.domain.MemberFolder;
import com.web.SearchWeb.folder.error.FolderErrorCode;
import com.web.SearchWeb.folder.error.FolderException;
import com.web.SearchWeb.folder.service.MemberFolderService;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * D-1 회귀: 실제 HTTP 요청 직렬화(Jackson)·Bean Validation·예외 처리기를 거치는 MockMvc 테스트.
 * DB 미접속(서비스 mock). Spring Security 필터 체인은 포함하지 않으며 인증 주체는 SecurityContext로 주입한다.
 */
@ExtendWith(MockitoExtension.class)
class MemberFolderControllerPinnedHttpTest {
    @Mock MemberFolderService service;
    MockMvc mvc;

    @BeforeEach void setup() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mvc = MockMvcBuilders.standaloneSetup(new MemberFolderController(service))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setCustomArgumentResolvers(new CurrentMemberIdArgumentResolver())
            .setValidator(validator)
            .build();
        login(1L);
    }

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    private void login(long memberId) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            new JwtMemberPrincipal(memberId, "ROLE_USER"), null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    private ResultActions patchPinned(long folderId, String body) throws Exception {
        return mvc.perform(patch("/api/folders/{id}/pinned", folderId)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private MemberFolder folder(long id, boolean pinned) {
        return MemberFolder.builder().memberFolderId(id).ownerMemberId(1L).folderName("F" + id)
            .folderType(FolderType.CUSTOM).pinned(pinned).build();
    }

    private void expectInvalidRequest(ResultActions r) throws Exception {
        r.andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("F010"));
    }

    // ---- D-1 본건: 누락/null/잘못된 JSON/잘못된 타입은 400, 서비스 미호출 ----

    @Test void emptyBodyObjectReturns400NotServerError() throws Exception {
        expectInvalidRequest(patchPinned(5L, "{}"));
        verifyNoInteractions(service);
    }

    @Test void nullPinnedReturns400() throws Exception {
        expectInvalidRequest(patchPinned(5L, "{\"pinned\":null}"));
        verifyNoInteractions(service);
    }

    @Test void malformedJsonReturns400() throws Exception {
        expectInvalidRequest(patchPinned(5L, "{\"pinned\":"));
        verifyNoInteractions(service);
    }

    @Test void missingBodyReturns400() throws Exception {
        expectInvalidRequest(patchPinned(5L, ""));
        verifyNoInteractions(service);
    }

    @Test void nonBooleanTextReturns400() throws Exception {
        expectInvalidRequest(patchPinned(5L, "{\"pinned\":\"abc\"}"));
        verifyNoInteractions(service);
    }

    @Test void objectTypeReturns400() throws Exception {
        expectInvalidRequest(patchPinned(5L, "{\"pinned\":{}}"));
        verifyNoInteractions(service);
    }

    // ---- 기존 Jackson 기본 coercion 계약(변경하지 않음) 특성화 ----

    @Test void existingJacksonCoercionOfBooleanStringIsUnchanged() throws Exception {
        when(service.setPinned(1L, 5L, true)).thenReturn(folder(5L, true));
        patchPinned(5L, "{\"pinned\":\"true\"}").andExpect(status().isOk());
        verify(service).setPinned(1L, 5L, true);
    }

    // ---- 정상 true/false ----

    @Test void pinTrueReturns200WithServerValue() throws Exception {
        when(service.setPinned(1L, 5L, true)).thenReturn(folder(5L, true));
        patchPinned(5L, "{\"pinned\":true}").andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.memberFolderId").value(5))
            .andExpect(jsonPath("$.data.pinned").value(true));
    }

    @Test void pinFalseReturns200WithServerValue() throws Exception {
        when(service.setPinned(1L, 5L, false)).thenReturn(folder(5L, false));
        patchPinned(5L, "{\"pinned\":false}").andExpect(status().isOk())
            .andExpect(jsonPath("$.data.pinned").value(false));
    }

    // ---- 기존 오류 계약 유지 ----

    @Test void otherOwnersFolderKeeps403() throws Exception {
        when(service.setPinned(1L, 7L, true)).thenThrow(new FolderException(FolderErrorCode.FOLDER_FORBIDDEN));
        patchPinned(7L, "{\"pinned\":true}").andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error.code").value("F003"));
    }

    // ---- 타계정 폴더 403 오류코드 F003 (기존 오타 Foo3 수정) 회귀 ----

    private void expectForbiddenF003(ResultActions r) throws Exception {
        r.andExpect(status().isForbidden())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.error.code").value("F003"));
    }

    @Test void otherOwnersFolderGetReturns403F003() throws Exception {
        when(service.get(1L, 7L)).thenThrow(new FolderException(FolderErrorCode.FOLDER_FORBIDDEN));
        expectForbiddenF003(mvc.perform(get("/api/folders/{id}", 7L)));
    }

    @Test void otherOwnersFolderUpdateReturns403F003() throws Exception {
        doThrow(new FolderException(FolderErrorCode.FOLDER_FORBIDDEN))
            .when(service).update(1L, 7L, "X", null);
        expectForbiddenF003(mvc.perform(put("/api/folders/{id}", 7L)
            .contentType(MediaType.APPLICATION_JSON).content("{\"folderName\":\"X\"}")));
    }

    @Test void otherOwnersFolderDeleteReturns403F003() throws Exception {
        doThrow(new FolderException(FolderErrorCode.FOLDER_FORBIDDEN)).when(service).delete(1L, 7L);
        expectForbiddenF003(mvc.perform(delete("/api/folders/{id}", 7L)));
    }

    @Test void folderErrorCodesAreUniqueAndForbiddenIsF003() {
        org.junit.jupiter.api.Assertions.assertEquals("F003", FolderErrorCode.FOLDER_FORBIDDEN.getCode());
        long distinct = java.util.Arrays.stream(FolderErrorCode.values()).map(FolderErrorCode::getCode).distinct().count();
        org.junit.jupiter.api.Assertions.assertEquals(FolderErrorCode.values().length, distinct);
    }

    @Test void missingFolderKeeps404() throws Exception {
        when(service.setPinned(1L, 999L, true)).thenThrow(new FolderException(FolderErrorCode.FOLDER_NOT_FOUND));
        patchPinned(999L, "{\"pinned\":true}").andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error.code").value("F001"));
    }

    @Test void invalidPinTargetKeeps400F009() throws Exception {
        when(service.setPinned(1L, 8L, true)).thenThrow(new FolderException(FolderErrorCode.INVALID_PIN_TARGET));
        patchPinned(8L, "{\"pinned\":true}").andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("F009"));
    }

    @Test void unauthenticatedKeeps401BeforeBodyValidation() throws Exception {
        SecurityContextHolder.clearContext();
        patchPinned(5L, "{}").andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error.code").value("A001"));
        verifyNoInteractions(service);
    }

    @Test void unexpectedServerErrorStill500() throws Exception {
        when(service.setPinned(1L, 5L, true)).thenThrow(new IllegalStateException("boom"));
        patchPinned(5L, "{\"pinned\":true}").andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.error.code").value("C006"));
    }

    // ---- 같은 컨트롤러의 다른 @Valid 입력(대표 회귀) ----

    @Test void createFolderValidationFailureAlsoReturns400() throws Exception {
        mvc.perform(post("/api/folders").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error.code").value("F010"));
        verifyNoInteractions(service);
    }

    @Test void createFolderValidRequestStill201() throws Exception {
        when(service.create(eq(1L), isNull(), eq("New"), isNull(), eq(false))).thenReturn(10L);
        mvc.perform(post("/api/folders").contentType(MediaType.APPLICATION_JSON).content("{\"folderName\":\"New\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data").value(10));
    }
}
