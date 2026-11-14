# 미분류(디폴트) 폴더 도입 계획서

> **문서 정보**
> - **버전:** v0.1.0 (Draft)
> - **작성일:** 2026-04-18
> - **관련 화면:** `/my-links`, `SaveLinkDialog`
- **관련 문서:** [SearchWeb PRD](../../Searchweb_PRD.md), [My Links 검색 기능 계획서](../my-links-search/spec.md)
> - **문서 목적:** "미분류" 개념을 **시스템 폴더(`folder_type='UNORGANIZED'`)** 로 정의하고, 이를 도입하기 위한 데이터 모델·서비스·UI 변경 사항을 정의한다.

<br>

## 1. 개요

`/my-links` 화면 상단에는 `Unorganized` 칩이 존재하지만, 현재 정의·동작이 비어 있다 (`frontend/src/app/my-links/page.tsx:179`).

기존 시스템에서 "미분류"를 정의할 수 있는 방법은 두 가지였다.

- ⓐ **태그 부재 기반** — 해시태그가 비어 있는 링크를 미분류로 간주
- ⓑ **물리적 시스템 폴더 기반** — `folder_type='UNORGANIZED'` 인 시스템 폴더를 자동 생성하고, 분류되지 않은 링크는 이 폴더에 저장

본 계획서는 사전 인터뷰 결과(`deep-interview` round 4 / 최종 ambiguity 14%)에 따라 **ⓑ 디폴트 폴더 방식**을 채택한다.
이유:
- 폴더와 태그가 직교 개념(현재 코드 기준)이라 태그 부재 = 미분류 정의는 의미가 약함
- 사용자가 미분류 칩을 클릭했을 때 동작을 **기존 폴더 클릭과 동일하게** 통일할 수 있음 (`setSelectedFolderId(defaultFolderId)`)
- AI 분류 실패/사용자 미선택 케이스 둘 다 같은 위치로 모이므로 회수(回收) 동선이 단순해짐

<br>

## 2. 문제 정의

현재 구조에서 디폴트 폴더 도입을 막고 있는 결손은 다음과 같다.

1. **데이터 모델**: `member_folder` 테이블과 `MemberFolder` 엔티티 모두 폴더 타입(`NORMAL`, `UNORGANIZED` 등)을 식별할 수 있는 필드가 없다.
2. **자동 생성 시점 부재**: 회원가입(소셜) 흐름(`CustomOAuth2MemberService.loadUser` 73~95행)에서 폴더 생성 호출이 없다. 기존 회원에 대한 백필 경로도 없다.
3. **불변 정책 부재**: `MemberFolderServiceImpl.delete/move/update` 가 시스템 폴더에 대한 가드 없이 일반 폴더와 동일하게 동작한다.
4. **저장 경로 분기 부재**: `SaveLinkDialog.handleSave` (`frontend/src/components/dialogs/SaveLinkDialog.tsx:261`) 가 `selectedFolderId === null && !pendingNewFolderName` 일 때 `memberFolderId: null` 을 전송하는데, 이를 받는 백엔드는 폴더 NULL 을 허용하지 않는다(현 스키마: `"member_folder_id" int NOT NULL`). → **폴더 미선택 저장 자체가 불가능**.
5. **UI**: `Unorganized` 칩에 onClick 미연결, `FolderCard` 메뉴(이름변경/이동/삭제)가 시스템 폴더에서도 동일하게 표시됨.

<br>

## 3. 목표

### 3.1 사용자 목표

- 사용자가 폴더를 정하지 않고도 링크를 저장할 수 있다 (퀵 세이브 경로).
- 사용자가 `Unorganized` 칩을 누르면 미분류 폴더의 링크 목록을 즉시 볼 수 있다.
- 사용자는 미분류 폴더를 실수로 삭제·이동할 수 없다 (이름 변경은 허용).

### 3.2 제품 목표

- 시스템 폴더를 데이터 모델 차원에서 일급(first-class)으로 표현한다.
- 신규/기존 사용자 모두에게 정확히 1개의 미분류 폴더를 보장한다 (idempotent).
- AI 폴더 추천 실패·미선택 같은 후속 시나리오를 같은 디폴트 폴더로 모은다.

### 3.3 비목표 (이번 이터레이션 제외)

- AI 폴더 추천이 실패했을 때 자동으로 디폴트 폴더로 폴백하는 로직 (Future Section)
- 폴더 이름의 다국어화 / 사용자 커스텀 (이번에는 한국어 `미분류` 고정)
- 디폴트 폴더 안의 링크에 대한 "이주" 기능 (다른 폴더로 옮기면 자동 비분류 해제 등)

<br>

## 4. 결정 사항 요약 (인터뷰 산출)

| 항목 | 결정 | 비고 |
| :--- | :--- | :--- |
| 미분류 정의 | 시스템 폴더(`folder_type='UNORGANIZED'`)에 보관된 링크 | 태그 부재 정의 폐기 |
| 마이그레이션 전략 | **회원가입 로직 변경 + 기존 회원 lazy 생성** | 옵션 3 (권장안) |
| 디폴트 폴더 제약 | 삭제 ✗ / 이름 변경 ✓ / 이동 ✗ / 자식 ✓ | 옵션 B (느슨한) |
| 저장 정책 | **이번 이터레이션에 Quick Save 포함** | 옵션 2 (권장안) |
| AI 실패 폴백 | 본 이터레이션 제외 | Future Section |

<br>

## 5. 데이터 모델 변경

### 5.1 `member_folder` 테이블

`src/main/resources/db/init_postgres.sql` (96~113행) 의 정의에 컬럼·제약 추가.

```sql
-- 1. 폴더 타입 컬럼 추가 (기본값 CUSTOM)
ALTER TABLE "member_folder"
  ADD COLUMN IF NOT EXISTS "folder_type" varchar(20) NOT NULL DEFAULT 'CUSTOM';

-- 2. 타입 제약 추가 (향후 TRASH, ARCHIVE 등 확장 가능)
ALTER TABLE "member_folder"
  DROP CONSTRAINT IF EXISTS ck_member_folder_type,
  ADD CONSTRAINT ck_member_folder_type CHECK (folder_type IN ('CUSTOM', 'UNORGANIZED'));

-- 3. 한 사용자당 시스템 폴더(UNORGANIZED)는 정확히 1개만 활성 상태로 존재하도록 유니크 제약
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_folder_owner_unorganized
  ON "member_folder" ("owner_member_id")
  WHERE folder_type = 'UNORGANIZED' AND deleted_at IS NULL;

-- 4. member_saved_link 테이블 정합성 정리 및 FK 추가
-- (주의: FK 추가 전, member_folder_id가 유효하지 않은 데이터가 있는지 점검 필수)
ALTER TABLE "member_saved_link"
  ADD CONSTRAINT fk_member_saved_link_member_folder_id
  FOREIGN KEY ("member_folder_id") REFERENCES "member_folder"("member_folder_id");
```

`init_postgres.sql` 본체에도 컬럼/제약/인덱스를 반영하여 신규 환경에서 자동 적용되도록 한다.
특히 `member_saved_link` 정의 시점에 `member_folder_id`에 대한 FK가 누락되어 있으므로 이를 보강한다.

### 5.2 `MemberFolder` 엔티티

`src/main/java/com/web/SearchWeb/folder/domain/MemberFolder.java`:

- `private String folderType;` 필드 추가 (기본값 `"CUSTOM"`).
- `isUnorganized()` 편의 메서드 추가.
- `changeParent()` / `delete*` 같이 자기 자신을 변경하는 도메인 메서드들이 시스템 폴더 위반을 방어할 수 있도록, 메서드 레벨에서 `if (isUnorganized()) throw new BusinessException(FolderErrorCode.SYSTEM_FOLDER_IMMUTABLE);` 가드를 추가한다 (이름 변경 `changeInfo` 는 가드 제외).

### 5.3 `FolderErrorCode` 추가

`src/main/java/com/web/SearchWeb/folder/error/FolderErrorCode.java` 에 다음을 추가:

- `SYSTEM_FOLDER_IMMUTABLE` (HTTP 409, "기본 폴더는 삭제하거나 이동할 수 없습니다.")
- `DEFAULT_FOLDER_NAME_CONFLICT` (HTTP 409, 이미 같은 이름의 폴더가 있어 디폴트 폴더 자동 생성 실패 시)

<br>

## 6. 백엔드 변경 사항

### 6.1 서비스 인터페이스 확장

`src/main/java/com/web/SearchWeb/folder/service/MemberFolderService.java`:

```java
/** 미분류 폴더 보장. 없으면 생성, 있으면 기존 ID 반환. idempotent. */
Long getOrCreateUnorganizedFolderId(Long memberId);

/** 미분류 폴더 단건 조회. 없으면 getOrCreate 호출 후 반환. */
MemberFolder getDefaultFolder(Long memberId);
```

### 6.2 `MemberFolderServiceImpl` 변경

- **`getOrCreateUnorganizedFolderId(memberId)`** 신규 구현
  - `findByOwnerAndFolderType(memberId, "UNORGANIZED")` 로 조회 → 있으면 그 ID 반환.
  - 없으면 `MemberFolder.builder().ownerMemberId(memberId).folderName("미분류").folderType("UNORGANIZED").build()` 로 저장.
  - 동시 호출(중복 INSERT)은 5.1의 부분 유니크 인덱스가 막고, `DataIntegrityViolationException` catch 후 재조회로 복구.
- **`delete(memberId, folderId)`** 가드 추가
  - 조회 후 `if (folder.isUnorganized()) throw FolderErrorCode.SYSTEM_FOLDER_IMMUTABLE` (현재 자식/북마크 가드 앞단).
- **`move(memberId, folderId, newParentFolderId)`** 가드 추가
  - 동일하게 시스템 폴더면 차단.
- **`update(memberId, ...)`** 는 가드 없음 (이름 변경 허용 — 결정 5.B).
- **`listRootFolders(memberId, ownerMemberId)`** 끝부분에 lazy 보장 추가
  - `getOrCreateUnorganizedFolderId(ownerMemberId)` 를 1회 호출하여 기존 회원에게도 자동 백필.
  - 호출은 idempotent 하므로 매 요청마다 안전. (성능 영향은 7.2 참고)

### 6.3 회원가입 흐름 통합

**소셜 회원가입** — `CustomOAuth2MemberService.loadUser` (73~95행)

```java
if (existMember == null) {
    // 기존 코드: insertSocialMember(...)
    memberDao.insertSocialMember(member);
    existMember = member;
    // 신규: 디폴트 폴더 생성. 실패해도 가입 자체는 진행시켜야 하므로 try-catch 후 로그.
    try {
        memberFolderService.getOrCreateUnorganizedFolderId(existMember.getMemberId());
    } catch (Exception e) {
        log.warn("default folder creation failed (will be lazily created on first listRootFolders): {}", e.getMessage());
    }
}
```

`MemberFolderService` 의존성을 생성자 주입으로 추가. 순환 의존성 방지를 위해 `MemberFolderService` 가 `member` 도메인을 역방향으로 참조하지 않는지 점검 (현재 `MemberFolderServiceImpl` 은 `MemberFolderRepository` 만 사용하므로 안전).

**로컬 회원가입** — 별도 `JoinController` 가 코드베이스에 존재하지 않음 (탐색 결과). 향후 로컬 회원가입을 추가할 때 `MemberServiceImpl` 의 신규 가입 메서드에서 동일하게 호출하도록 가이드만 명시.

**기존 회원 백필** — 6.2의 `listRootFolders` lazy 호출이 담당. 별도 마이그레이션 SQL은 작성하지 않는다.

### 6.4 컨트롤러

`MemberFolderController` 자체에는 변경이 없다 (서비스 가드가 도메인 규칙을 책임짐). 단, 응답 DTO `MemberFolderResponses` 에 `isSystem` 필드를 추가하여 프론트에 노출한다.

```java
public class MemberFolderResponses {
    public Long memberFolderId;
    public Long ownerMemberId;
    public Long parentFolderId;
    public String folderName;
    public String description;
    public String folderType; // ← 추가
    public static MemberFolderResponses from(MemberFolder f) { ... }
}
```

<br>

## 7. 보안 / 인가 / 성능

### 7.1 보안 / 인가

- **소유권 가드**는 기존 `validateOwner(memberId, folder)` 로직 그대로 유지. `is_system` 은 추가 제약일 뿐 소유권 검사를 대체하지 않는다.
- **`@OwnerCheck` AOP** 가 적용된 메서드들은 이미 다른 사용자의 폴더 접근을 차단하므로, `getOrCreateUnorganizedFolderId` 도 `memberId` 인자만 신뢰한다 (Controller 진입점으로 주입된 값을 사용).
- **DELETE/MOVE 우회 시도**: 클라이언트가 `folderType` 응답을 무시하고 강제로 `DELETE /api/folders/{id}` 를 호출해도 6.2의 서비스 가드에서 `409` 로 차단한다. 컨트롤러 레벨에서 별도 검증을 두지 않는다 (단일 진실 공급원: 서비스).

### 7.2 성능

- **`listRootFolders` 마다 ensure 호출**의 비용은 인덱스 룩업 1회(부분 유니크 인덱스 적중) → 정상 케이스에서 무시 가능 수준.
- 부담이 측정되면 후속 단계에서 다음 두 옵션을 검토:
  - 옵션 A: 회원가입 시점에만 생성하고, 기존 회원에 대해서는 1회성 마이그레이션 SQL 실행.
  - 옵션 B: 메모리/Redis 캐시에 "이 회원은 이미 디폴트 폴더 보유" 플래그를 두고, 첫 호출 이후 ensure 스킵.
- 본 이터레이션은 단순성을 우선하여 옵션 A/B 모두 보류.

### 7.3 트랜잭션 / 동시성

- `getOrCreateUnorganizedFolderId` 는 `@Transactional` 로 감싸고, INSERT 실패 시 재조회(read-after-write) 후 반환.
- 부분 유니크 인덱스(`uq_member_folder_owner_system`)가 동시 회원가입·동시 첫 호출의 경합을 DB 레벨에서 차단.

<br>

## 8. 프론트엔드 변경 사항

### 8.1 타입 확장

`frontend/src/lib/types/folder.ts` 의 `FolderResponse` 에 `folderType: 'CUSTOM' | 'UNORGANIZED'` 추가.

### 8.2 `Unorganized` 칩 클릭 동작

`frontend/src/app/my-links/page.tsx:179` 의 placeholder 버튼:

```tsx
const defaultFolder = folders?.find(f => f.folderType === 'UNORGANIZED');

<button
  type="button"
  onClick={() => defaultFolder && setSelectedFolderId(defaultFolder.memberFolderId)}
  disabled={!defaultFolder}
  className="..."
>
  <span className="material-symbols-outlined !text-[12px] text-rose-400">inventory_2</span>
  Unorganized
</button>
```

폴더 카드 클릭과 동일한 동작이므로 별도 분기·별도 패널 없음. 우측 패널은 자동으로 미분류 폴더의 북마크를 조회한다 (`useBookmarks({ folderId })`).

### 8.3 폴더 카드 메뉴 가드

`frontend/src/components/my-links/FolderCard.tsx`:

- 시스템 폴더이면 메뉴 자체를 숨길지, "Move/Delete" 항목만 비활성화할지 결정. 결정 5.B(이름 변경 허용)에 따라 **메뉴는 표시하되 Move/Delete 항목만 disabled** 로 처리 (`folderType === 'UNORGANIZED'`).
- 카드 좌상단 아이콘에 미분류 표식(예: `inventory_2`) 추가하여 시각적으로 구분.

### 8.4 폴더 목록 정렬

`useFolders` 응답을 화면에 표시할 때 디폴트 폴더는 항상 **목록 최상단** 또는 **별도 섹션**에 위치하도록 정렬 (UX 결정은 디자인 단계에서 확정).
일단 1차에서는 "최상단 고정" 으로 단순 구현.

### 8.5 Quick Save 경로 (결정 5.옵션 2)

`frontend/src/components/dialogs/SaveLinkDialog.tsx`:

- `handleSave` (261행) 에서 `selectedFolderId === null && !pendingNewFolderName` 인 경우, 디폴트 폴더 ID로 저장하도록 보강.
  ```tsx
  const targetFolderId = selectedFolderId
    ?? folders?.find(f => f.folderType === 'UNORGANIZED')?.memberFolderId
    ?? null;
  ```
- "Save to Workspace" 버튼 옆 또는 메인 버튼에 `Quick Save` 라벨/툴팁 추가 (디자인 단에서 라벨 확정).
- `useBookmarks`/`useCreateBookmark` 등 API 호출은 변경 없음. 백엔드는 `member_folder_id` NOT NULL 제약을 유지하면서 디폴트 폴더 ID를 받는다.

### 8.6 RightPanel 빈 상태

`frontend/src/components/my-links/RightPanel.tsx:329` 의 `'Unordered'` 폴백 라벨 제거 또는 디폴트 폴더에 한해 "AI 분류 대기 중인 링크" 같은 안내 카피로 대체 (선택 사항).

<br>

## 9. 구현 순서

### 9.1 1단계 — DB / 도메인 (백엔드 단독 머지 가능)

1. `init_postgres.sql` 에 컬럼·인덱스 반영 + 마이그레이션 스크립트 작성.
2. `MemberFolder` 엔티티 + Repository 메서드(`findByOwnerMemberIdAndIsSystemTrue`) 추가.
3. `FolderErrorCode` 신규 코드 추가.

### 9.2 2단계 — 서비스 레이어

4. `MemberFolderService#getOrCreateUnorganizedFolderId`, `getDefaultFolder` 추가.
5. `MemberFolderServiceImpl` 의 delete/move 가드 추가.
6. `listRootFolders` 끝에서 `getOrCreateUnorganizedFolderId` 호출.
7. **단위 테스트**:
   - `getOrCreateUnorganizedFolderId` 가 idempotent 한가
   - 시스템 폴더 delete/move 차단
   - 시스템 폴더 update(이름 변경) 허용
   - 동시 호출 시 단일 폴더만 생성됨 (부분 유니크 인덱스 검증)

### 9.3 3단계 — 회원가입 통합

8. `CustomOAuth2MemberService` 에 `MemberFolderService` 의존성 주입 + `getOrCreateUnorganizedFolderId` 호출.
9. **통합 테스트**: 신규 OAuth 가입 → 폴더 목록 조회 시 미분류 폴더 1건 보장.

### 9.4 4단계 — API 계약

10. `MemberFolderResponses.isSystem` 필드 추가.
11. 프론트 타입 `FolderResponse.folderType` 추가.

### 9.5 5단계 — 프론트엔드 UI

12. `Unorganized` 칩 onClick 연결 (`page.tsx:179`).
13. `FolderCard` 메뉴 가드 + 시각적 표식.
14. 디폴트 폴더 최상단 고정 정렬.
15. `SaveLinkDialog.handleSave` 의 폴더 미선택 → 디폴트 폴더 fallback.

### 9.6 6단계 — 검증 / QA

16. E2E: 신규 가입 → 링크 저장(폴더 미선택) → My Links 의 Unorganized 칩 클릭 → 방금 저장한 링크 노출 확인.
17. 기존 회원: 첫 `/my-links` 진입 → 미분류 폴더 자동 생성 확인.
18. 디폴트 폴더 삭제·이동 시 409 반환 / 토스트 메시지 확인.
19. 동시 가입(부하 테스트) 시 디폴트 폴더 중복 생성 없음 확인.

<br>

## 10. 위험 및 완화

| 위험 | 영향 | 완화책 |
| :--- | :--- | :--- |
| 동일 사용자가 같은 이름("미분류") 폴더를 이미 만들어 둠 | `getOrCreateUnorganizedFolderId` 의 INSERT 가 `uq_member_folder_parent_name` 위반 | catch 후 해당 폴더의 `folder_type`을 `UNORGANIZED`로 업데이트하여 흡수, 또는 시스템 폴더 이름을 `미분류 (기본)` 로 회피. 1차에는 흡수 채택. |
| 데이터 기존 오염 가능성 | `member_saved_link` 에 존재하지 않는 폴더 ID가 있으면 FK 추가 시 에러 발생 | 마이그레이션 SQL 실행 전 `SELECT ... WHERE member_folder_id NOT IN (SELECT ...)` 로 전수 조사 및 유효한 폴더(UNORGANIZED 등)로 업데이트 필요 |
| `listRootFolders` 마다 ensure 호출 → 트랜잭션 비용 | RPS 높을 때 약간의 부하 증가 | 7.2 의 옵션 A/B 로 후속 최적화 |
| 사용자가 "미분류" 라는 이름을 일반 폴더에 쓰고 싶어함 | 명명 충돌 혼란 | 시스템 폴더는 `is_system` 으로만 식별, 일반 폴더 이름은 자유. UI에서 시스템 폴더에 별도 아이콘 표기 |
| AI 분류 실패 시 별도 대응 부재 (이번 이터레이션) | UX 미세 결손 | Future Section: AI 실패 시 디폴트 폴더로 자동 fallback |

<br>

## 11. Future Section

- **AI 폴더 추천 실패 시 자동 폴백**: `BookmarkService.create` 가 폴더 ID 미결정 상태로 호출되면 디폴트 폴더로 흡수하고 별도 플래그(`category_source='system'` 등)로 회수 가능하게 표시.
- **다국어화**: `미분류` 라는 폴더명을 지역 설정에 따라 표시 (백엔드 저장 이름은 고정, 프론트에서 i18n 변환).
- **자동 정리**: 디폴트 폴더 안의 링크 중 일정 시간이 지난 것을 사용자에게 분류 제안하는 inbox-like UX.

<br>

## 12. 결론

본 계획서는 "미분류" 의 정의를 **`is_system=true` 디폴트 폴더 1개** 로 일원화하고, 그 도입을 다음 5단계로 진행한다.

- **데이터 모델**: `folder_type` 컬럼 + 부분 유니크 인덱스 + `member_saved_link` FK 추가
- **서비스**: `getOrCreateUnorganizedFolderId` (idempotent) + delete/move 가드 (타입 기반 식별)
- **회원가입 통합**: OAuth 가입 시 즉시 생성, 기존 회원은 `listRootFolders` 에서 lazy 백필
- **API/타입**: `folderType` 필드 노출
- **UI**: `Unorganized` 칩 onClick + `FolderCard` 메뉴 가드 + `SaveLinkDialog` Quick Save 폴백 (타입 기반 식별)

각 단계가 독립적으로 머지 가능하며, 1~3단계 머지 후 4~5단계가 그 위에 안전하게 빌드된다.
