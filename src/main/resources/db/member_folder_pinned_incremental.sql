-- ==============================================================================
-- [폴더 고정(Pinning) 기능 지원을 위한 증분 마이그레이션 스크립트]
-- * 주의: 로컬 마이그레이션 산출물이므로, 운영 배포 시에는 사전 승인 및 인덱스 충돌 여부 확인 후 적용할 것.
-- ==============================================================================

-- [단계 1] is_pinned 컬럼 추가 (기본값 false, IF NOT EXISTS로 중복 생성 방지)
ALTER TABLE member_folder ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- [단계 2] 신규 데이터 INSERT 시 적용될 기본값을 false로 명시적 보장
ALTER TABLE member_folder ALTER COLUMN is_pinned SET DEFAULT false;

-- [단계 3] 기존 레코드 백필(Backfill): 기존 데이터 중 NULL인 행들을 모두 false로 일괄 갱신
UPDATE member_folder SET is_pinned = false WHERE is_pinned IS NULL;

-- [단계 4] 데이터가 모두 채워진 후 안전하게 NOT NULL 제약조건 부여 (락 최소화 및 오류 방지)
ALTER TABLE member_folder ALTER COLUMN is_pinned SET NOT NULL;

-- [단계 5] 고정 폴더 조회 최적화용 복합 인덱스 생성
-- (조회 조건: WHERE owner_member_id = ? AND is_pinned = true 탐색 시 인덱스 레인지 스캔 지원)
CREATE INDEX IF NOT EXISTS idx_member_folder_owner_pinned ON member_folder (owner_member_id, is_pinned);

-- ==============================================================================
-- [롤백 가이드]
-- 배포 후 롤백이 필요한 경우 컬럼을 즉시 삭제(DROP COLUMN)하지 말고,
-- 애플리케이션만 이전 버전으로 롤백하여 사용자가 고정한 true 데이터가 유실되지 않도록 보존할 것.
-- ==============================================================================
