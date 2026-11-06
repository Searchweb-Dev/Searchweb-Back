

BEGIN;

-- =========================
-- TABLES
-- =========================

CREATE TABLE IF NOT EXISTS "category_master" (
  "category_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "parent_category_id" int,
  "category_name" varchar(80) NOT NULL,
  "category_level" smallint NOT NULL,
  "is_active" boolean NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_category_master PRIMARY KEY ("category_id"),
  CONSTRAINT ck_category_master_level CHECK (category_level in (1,2)),
  CONSTRAINT fk_category_master_parent_category_id
    FOREIGN KEY ("parent_category_id") REFERENCES "category_master"("category_id")
);

CREATE TABLE IF NOT EXISTS "link" (
  "link_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "canonical_url" text NOT NULL,
  "original_url" text NOT NULL,
  "domain" varchar(255),
  "title" varchar(255),
  "description" text,
  "thumbnail_url" text,
  "favicon_url" text,
  "content_type" varchar(30) DEFAULT 'link' NOT NULL,
  "primary_category_id" int NOT NULL,
  "category_score" numeric(5,4),
  "classifier_version" varchar(50),
  "categorized_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_link PRIMARY KEY ("link_id"),
  CONSTRAINT uq_link_canonical_url UNIQUE ("canonical_url"),
  CONSTRAINT ck_link_content_type CHECK (content_type in ('link','article','video','pdf','etc')),
  CONSTRAINT ck_link_category_score_range CHECK (category_score is null or (category_score between 0 and 1))
);

CREATE TABLE IF NOT EXISTS "member" (
  "member_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "email" varchar(255),
  "login_id" varchar(50),  -- 기존 username 대체
  "password_hash" varchar(255),
  "member_name" varchar(20),
  "nick_name" varchar(50),
  "job" varchar(20),
  "major" varchar(20),
  "summary" varchar(100) DEFAULT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "role" varchar(20) DEFAULT 'ROLE_USER' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_member PRIMARY KEY ("member_id"),
  CONSTRAINT uq_member_email UNIQUE ("email"),
  CONSTRAINT uq_member_login_id UNIQUE ("login_id"),
  CONSTRAINT ck_member_login_pw_pair
    CHECK ((login_id is null and password_hash is null) OR (login_id is not null and password_hash is not null)),
  CONSTRAINT ck_member_status CHECK (status in ('active','blocked'))
);

CREATE TABLE IF NOT EXISTS "refresh_token" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_id" bigint NOT NULL,
  "session_id" varchar(36) NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "rotated_at" timestamptz,
  "replaced_by_version" integer,
  "grace_until" timestamptz,
  CONSTRAINT pk_refresh_token PRIMARY KEY ("id"),
  CONSTRAINT uq_refresh_token_hash UNIQUE ("token_hash"),
  CONSTRAINT uq_refresh_token_session_version UNIQUE ("session_id", "version"),
  CONSTRAINT fk_refresh_token_member_id FOREIGN KEY ("member_id") REFERENCES "member"("member_id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "member_folder" (
  "member_folder_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "owner_member_id" bigint NOT NULL,
  "parent_folder_id" int,
  "folder_name" varchar(80) NOT NULL,
  "description" text,
  "folder_type" varchar(20) DEFAULT 'CUSTOM' NOT NULL,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_member_folder PRIMARY KEY ("member_folder_id"),
  CONSTRAINT ck_member_folder_type CHECK (folder_type IN ('CUSTOM', 'UNORGANIZED')),
  CONSTRAINT fk_member_folder_parent_folder_id
    FOREIGN KEY ("parent_folder_id") REFERENCES "member_folder"("member_folder_id"),
  CONSTRAINT fk_member_folder_owner_member_id
    FOREIGN KEY ("owner_member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "member_tag" (
  "member_tag_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "owner_member_id" bigint NOT NULL,
  "tag_name" varchar(50) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_member_tag PRIMARY KEY ("member_tag_id"),
  CONSTRAINT uq_member_tag_owner_tag UNIQUE ("owner_member_id", "tag_name"),
  CONSTRAINT fk_member_tag_owner_member_id FOREIGN KEY ("owner_member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "team" (
  "team_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "team_name" varchar(80) NOT NULL,
  "owner_member_id" int NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_team PRIMARY KEY ("team_id"),
  CONSTRAINT fk_team_owner_member_id FOREIGN KEY ("owner_member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "team_tag" (
  "team_tag_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "team_id" int NOT NULL,
  "tag_name" varchar(50) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_team_tag PRIMARY KEY ("team_tag_id"),
  CONSTRAINT uq_team_tag_team_tag UNIQUE ("team_id", "tag_name"),
  CONSTRAINT fk_team_tag_team_id FOREIGN KEY ("team_id") REFERENCES "team"("team_id")
);

CREATE TABLE IF NOT EXISTS "team_folder" (
  "team_folder_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "team_id" int NOT NULL,
  "parent_folder_id" int,
  "folder_name" varchar(80) NOT NULL,
  "description" text,
  "created_by_member_id" int NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_team_folder PRIMARY KEY ("team_folder_id"),
  CONSTRAINT fk_team_folder_team_id FOREIGN KEY ("team_id") REFERENCES "team"("team_id"),
  CONSTRAINT fk_team_folder_parent_folder_id FOREIGN KEY ("parent_folder_id") REFERENCES "team_folder"("team_folder_id")
);

CREATE TABLE IF NOT EXISTS "team_folder_permission" (
  "team_folder_permission_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "team_folder_id" int NOT NULL,
  "member_id" int NOT NULL,
  "permission" varchar(20) DEFAULT 'viewer' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_team_folder_permission PRIMARY KEY ("team_folder_permission_id"),
  CONSTRAINT uq_team_folder_permission_folder_member UNIQUE ("team_folder_id", "member_id"),
  CONSTRAINT ck_team_folder_permission_permission CHECK (permission in ('viewer','editor')),
  CONSTRAINT fk_team_folder_permission_folder_id FOREIGN KEY ("team_folder_id") REFERENCES "team_folder"("team_folder_id"),
  CONSTRAINT fk_team_folder_permission_member_id FOREIGN KEY ("member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "team_member" (
  "team_member_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "team_id" int NOT NULL,
  "member_id" int NOT NULL,
  "role" varchar(20) DEFAULT 'member' NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_team_member PRIMARY KEY ("team_member_id"),
  CONSTRAINT uq_team_member_team_member UNIQUE ("team_id", "member_id"),
  CONSTRAINT ck_team_member_role CHECK (role in ('owner','admin','member')),
  CONSTRAINT fk_team_member_team_id FOREIGN KEY ("team_id") REFERENCES "team"("team_id"),
  CONSTRAINT fk_team_member_member_id FOREIGN KEY ("member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "team_saved_link" (
  "team_saved_link_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "team_folder_id" int NOT NULL,
  "link_id" bigint NOT NULL,
  "created_by_member_id" int NOT NULL,
  "display_title" varchar(255) NOT NULL,
  "note" text,
  "primary_category_id" int,
  "category_source" varchar(10) DEFAULT 'system' NOT NULL,
  "category_score" numeric(5,4),
  "categorized_at" timestamptz,
  "sort_order" int NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_team_saved_link PRIMARY KEY ("team_saved_link_id"),
  CONSTRAINT ck_team_saved_link_category_source CHECK (category_source in ('system','member')),
  CONSTRAINT ck_team_saved_link_category_score CHECK (category_score is null or (category_score between 0 and 1)),
  CONSTRAINT ck_team_saved_link_sort_nonneg CHECK (sort_order >= 0),
  CONSTRAINT fk_team_saved_link_folder_id FOREIGN KEY ("team_folder_id") REFERENCES "team_folder"("team_folder_id"),
  CONSTRAINT fk_team_saved_link_link_id FOREIGN KEY ("link_id") REFERENCES "link"("link_id")
);

CREATE TABLE IF NOT EXISTS "team_saved_link_tag" (
  "team_saved_link_tag_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "team_saved_link_id" bigint NOT NULL,
  "team_tag_id" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_team_saved_link_tag PRIMARY KEY ("team_saved_link_tag_id"),
  CONSTRAINT uq_team_saved_link_tag_item_tag UNIQUE ("team_saved_link_id", "team_tag_id"),
  CONSTRAINT fk_team_saved_link_tag_link_id FOREIGN KEY ("team_saved_link_id") REFERENCES "team_saved_link"("team_saved_link_id"),
  CONSTRAINT fk_team_saved_link_tag_tag_id FOREIGN KEY ("team_tag_id") REFERENCES "team_tag"("team_tag_id")
);



CREATE TABLE IF NOT EXISTS "link_enrichment" (
  "link_enrichment_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "link_id" bigint NOT NULL,
  "request_url" text NOT NULL,
  "final_url" text,
  "fetch_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "classify_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "attempt_count" smallint NOT NULL,
  "last_attempt_at" timestamptz,
  "error_code" varchar(50),
  "error_message" text,
  "http_status" int,
  "latency_ms" int,
  "selected_site_name" varchar(255),
  "selected_title" text,
  "selected_description" text,
  "fetched_at" timestamptz,
  "predicted_category_id" int,
  "predicted_score" numeric(5,4),
  "classifier_version" varchar(50),
  "classified_at" timestamptz,
  "keyword_extractor_version" varchar(50),
  "keyword_source" varchar(30),
  "keyword_extracted_at" timestamptz,
  "suggested_member_folder_id" int,
  "suggested_team_folder_id" int,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_link_enrichment PRIMARY KEY ("link_enrichment_id"),
  CONSTRAINT ck_link_enrichment_fetch_status CHECK (fetch_status in ('pending','running','success','failed')),
  CONSTRAINT ck_link_enrichment_classify_status CHECK (classify_status in ('pending','running','success','failed')),
  CONSTRAINT ck_link_enrichment_attempt_nonneg CHECK (attempt_count >= 0),
  CONSTRAINT ck_link_enrichment_http_status_range CHECK (http_status is null or (http_status between 100 and 599)),
  CONSTRAINT ck_link_enrichment_latency_nonneg CHECK (latency_ms is null or latency_ms >= 0),
  CONSTRAINT ck_link_enrichment_score_range CHECK (predicted_score is null or (predicted_score between 0 and 1)),
  CONSTRAINT ck_link_enrichment_keyword_source CHECK (keyword_source is null or keyword_source in ('title','description','title_description','other')),
  CONSTRAINT ck_link_enrichment_suggested_folder_one
    CHECK ((suggested_member_folder_id is null) OR (suggested_team_folder_id is null)),
  CONSTRAINT fk_link_enrichment_link_id FOREIGN KEY ("link_id") REFERENCES "link"("link_id")
);

CREATE TABLE IF NOT EXISTS "oauth_member" (
  "oauth_member_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_id" bigint NOT NULL,
  "provider" varchar(30) NOT NULL,
  "provider_member_key" varchar(255) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_oauth_member PRIMARY KEY ("oauth_member_id"),
  CONSTRAINT uq_oauth_member_provider_key UNIQUE ("provider", "provider_member_key"),
  CONSTRAINT fk_oauth_member_member_id FOREIGN KEY ("member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "member_folder_tag" (
  "member_folder_tag_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_folder_id" int NOT NULL,
  "member_tag_id" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_member_folder_tag PRIMARY KEY ("member_folder_tag_id"),
  CONSTRAINT uq_member_folder_tag_item_tag UNIQUE ("member_folder_id", "member_tag_id"),
  CONSTRAINT fk_member_folder_tag_member_folder_id
    FOREIGN KEY ("member_folder_id") REFERENCES "member_folder"("member_folder_id"),
  CONSTRAINT fk_member_folder_tag_member_tag_id
    FOREIGN KEY ("member_tag_id") REFERENCES "member_tag"("member_tag_id")
);

CREATE TABLE IF NOT EXISTS "folder_suggestion_rule" (
  "folder_suggestion_rule_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "scope_type" varchar(10) DEFAULT 'member' NOT NULL,
  "owner_member_id" bigint,
  "team_id" int,
  "category_id" int NOT NULL,
  "member_folder_id" int,
  "team_folder_id" int,
  "priority" int NOT NULL,
  "is_active" boolean NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_folder_suggestion_rule PRIMARY KEY ("folder_suggestion_rule_id"),
  CONSTRAINT ck_folder_suggestion_rule_scope CHECK (scope_type in ('member','team')),
  CONSTRAINT ck_folder_suggestion_rule_scope_match CHECK (
    (scope_type='member' and owner_member_id is not null and team_id is null and member_folder_id is not null and team_folder_id is null)
    OR
    (scope_type='team' and team_id is not null and owner_member_id is null and team_folder_id is not null and member_folder_id is null)
  ),
  CONSTRAINT ck_folder_suggestion_rule_priority_nonneg CHECK (priority >= 0),
  CONSTRAINT fk_folder_suggestion_rule_member_folder_id
    FOREIGN KEY ("member_folder_id") REFERENCES "member_folder"("member_folder_id"),
  CONSTRAINT fk_folder_suggestion_rule_team_folder_id
    FOREIGN KEY ("team_folder_id") REFERENCES "team_folder"("team_folder_id"),
  CONSTRAINT fk_folder_suggestion_rule_owner_member_id FOREIGN KEY ("owner_member_id") REFERENCES "member"("member_id"),
  CONSTRAINT fk_folder_suggestion_rule_team_id FOREIGN KEY ("team_id") REFERENCES "team"("team_id")
);

CREATE TABLE IF NOT EXISTS "link_enrichment_keyword" (
  "link_enrichment_keyword_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "link_enrichment_id" int NOT NULL,
  "keyword" varchar(100) NOT NULL,
  "score" numeric(5,4),
  "rank" smallint NOT NULL,
  "source" varchar(30),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_link_enrichment_keyword PRIMARY KEY ("link_enrichment_keyword_id"),
  CONSTRAINT uq_link_enrichment_keyword_enrich_keyword UNIQUE ("link_enrichment_id", "keyword"),
  CONSTRAINT ck_link_enrichment_keyword_score CHECK (score is null or (score between 0 and 1)),
  CONSTRAINT ck_link_enrichment_keyword_rank_nonneg CHECK (rank >= 0),
  CONSTRAINT ck_link_enrichment_keyword_source CHECK (source is null or source in ('title','description','title_description','other')),
  CONSTRAINT fk_link_enrichment_keyword_link_enrichment_id
    FOREIGN KEY ("link_enrichment_id") REFERENCES "link_enrichment"("link_enrichment_id")
);

CREATE TABLE IF NOT EXISTS "member_saved_link" (
  "member_saved_link_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "link_id" bigint NOT NULL,
  "link_enrichment_id" int,
  "member_folder_id" int NOT NULL,
  "display_title" varchar(255) NOT NULL,
  "note" text,
  "primary_category_id" int,
  "category_source" varchar(10) DEFAULT 'system' NOT NULL,
  "category_score" numeric(5,4),
  "view_count" integer DEFAULT 0 NOT NULL,
  "last_viewed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_member_saved_link PRIMARY KEY ("member_saved_link_id"),
  CONSTRAINT ck_member_saved_link_category_source CHECK (category_source in ('system','member')),
  CONSTRAINT ck_member_saved_link_category_score CHECK (category_score is null or (category_score between 0 and 1)),
  CONSTRAINT ck_member_saved_link_view_count_nonneg CHECK (view_count >= 0),
  CONSTRAINT fk_member_saved_link_link_id FOREIGN KEY ("link_id") REFERENCES "link"("link_id"),
  CONSTRAINT fk_member_saved_link_link_enrichment_id FOREIGN KEY ("link_enrichment_id") REFERENCES "link_enrichment"("link_enrichment_id"),
  CONSTRAINT fk_member_saved_link_member_folder_id FOREIGN KEY ("member_folder_id") REFERENCES "member_folder"("member_folder_id")
);

-- (idempotent) 기존 DB에 대해 view_count / last_viewed_at 컬럼 추가
ALTER TABLE "member_saved_link" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "member_saved_link" ADD COLUMN IF NOT EXISTS "last_viewed_at" timestamptz;

CREATE TABLE IF NOT EXISTS "link_enrichment_feedback" (
  "link_enrichment_feedback_id" int GENERATED ALWAYS AS IDENTITY NOT NULL,
  "link_enrichment_id" int NOT NULL,
  "member_saved_link_id" int,
  "action" varchar(20) NOT NULL,
  "suggested_member_folder_id" int,
  "final_member_folder_id" int,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_link_enrichment_feedback PRIMARY KEY ("link_enrichment_feedback_id"),
  CONSTRAINT ck_link_enrichment_feedback_action CHECK (action in ('ACCEPT','MOVE','REJECT','IGNORE')),
  CONSTRAINT fk_link_enrichment_feedback_link_enrichment_id
    FOREIGN KEY ("link_enrichment_id") REFERENCES "link_enrichment"("link_enrichment_id")
);

CREATE TABLE IF NOT EXISTS "member_saved_link_tag" (
  "member_saved_link_tag_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_saved_link_id" bigint NOT NULL,
  "member_tag_id" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_member_saved_link_tag PRIMARY KEY ("member_saved_link_tag_id"),
  CONSTRAINT uq_member_saved_link_tag_item_tag UNIQUE ("member_saved_link_id", "member_tag_id"),
  CONSTRAINT fk_member_saved_link_tag_member_saved_link_id
    FOREIGN KEY ("member_saved_link_id") REFERENCES "member_saved_link"("member_saved_link_id"),
  CONSTRAINT fk_member_saved_link_tag_member_tag_id
    FOREIGN KEY ("member_tag_id") REFERENCES "member_tag"("member_tag_id")
);

-- ==================================================
-- LEGACY TABLES (Board, Comment, Likes, Website)
-- ==================================================

CREATE TABLE IF NOT EXISTS "website" (
  "website_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "name" varchar(100) NOT NULL,
  "korean_name" varchar(100),
  "description" text,
  "url" text NOT NULL,
  "category" varchar(50),
  "subcategory" varchar(50),
  "view_count" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_website PRIMARY KEY ("website_id")
);

CREATE TABLE IF NOT EXISTS "board" (
  "board_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "member_member_id" bigint NOT NULL,
  "url" text,
  "title" varchar(255) NOT NULL,
  "summary" text,
  "description" text,
  "hashtags" text,
  "likes_count" int DEFAULT 0 NOT NULL,
  "comments_count" int DEFAULT 0 NOT NULL,
  "bookmarks_count" int DEFAULT 0 NOT NULL,
  "views_count" int DEFAULT 0 NOT NULL,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_board PRIMARY KEY ("board_id"),
  CONSTRAINT fk_board_member_id FOREIGN KEY ("member_member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "comment" (
  "comment_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "board_board_id" bigint NOT NULL,
  "member_member_id" bigint NOT NULL,
  "member_nickname" varchar(50),
  "member_job" varchar(20),
  "member_major" varchar(20),
  "content" text NOT NULL,
  "created_date" timestamptz DEFAULT now() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_comment PRIMARY KEY ("comment_id"),
  CONSTRAINT fk_comment_board_id FOREIGN KEY ("board_board_id") REFERENCES "board"("board_id"),
  CONSTRAINT fk_comment_member_id FOREIGN KEY ("member_member_id") REFERENCES "member"("member_id")
);

CREATE TABLE IF NOT EXISTS "likes" (
  "likes_id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "board_board_id" bigint NOT NULL,
  "member_member_id" bigint NOT NULL,
  "is_liked" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "created_by_member_id" bigint,
  "updated_by_member_id" bigint,
  "deleted_by_member_id" bigint,
  CONSTRAINT pk_likes PRIMARY KEY ("likes_id"),
  CONSTRAINT uq_likes_board_member UNIQUE ("board_board_id", "member_member_id"),
  CONSTRAINT fk_likes_board_id FOREIGN KEY ("board_board_id") REFERENCES "board"("board_id"),
  CONSTRAINT fk_likes_member_id FOREIGN KEY ("member_member_id") REFERENCES "member"("member_id")
);

-- =========================
-- INDEXES (원본 유지 + 위험한 이름만 개선)
-- =========================

CREATE UNIQUE INDEX IF NOT EXISTS uq_category_child_name
  ON "category_master" ("parent_category_id", "category_name")
  WHERE parent_category_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_category_parent ON "category_master" ("parent_category_id");

CREATE UNIQUE INDEX IF NOT EXISTS uq_category_root_name
  ON "category_master" ("category_name")
  WHERE parent_category_id IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_category_name ON "category_master" ("category_name");
CREATE INDEX IF NOT EXISTS idx_category_level ON "category_master" ("category_level");
CREATE INDEX IF NOT EXISTS idx_category_active ON "category_master" ("is_active");
CREATE INDEX IF NOT EXISTS idx_category_deleted_at ON "category_master" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_link_domain ON "link" ("domain");
CREATE INDEX IF NOT EXISTS idx_link_original_url ON "link" ("original_url");
CREATE INDEX IF NOT EXISTS idx_link_title ON "link" ("title");
CREATE INDEX IF NOT EXISTS idx_link_content_type ON "link" ("content_type");
CREATE INDEX IF NOT EXISTS idx_link_primary_category ON "link" ("primary_category_id");
CREATE INDEX IF NOT EXISTS idx_link_categorized_at ON "link" ("categorized_at");
CREATE INDEX IF NOT EXISTS idx_link_created_at ON "link" ("created_at");
CREATE INDEX IF NOT EXISTS idx_link_deleted_at ON "link" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_member_status ON "member" ("status");
CREATE INDEX IF NOT EXISTS idx_member_created_at ON "member" ("created_at");
CREATE INDEX IF NOT EXISTS idx_member_deleted_at ON "member" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_refresh_token_member ON "refresh_token" ("member_id");
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON "refresh_token" ("token_hash");
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires ON "refresh_token" ("expires_at");

CREATE INDEX IF NOT EXISTS idx_member_folder_owner ON "member_folder" ("owner_member_id");
CREATE INDEX IF NOT EXISTS idx_member_folder_owner_pinned ON "member_folder" ("owner_member_id", "is_pinned");
CREATE INDEX IF NOT EXISTS idx_member_folder_parent ON "member_folder" ("parent_folder_id");
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_folder_parent_name
  ON "member_folder" ("owner_member_id", "parent_folder_id", "folder_name")
  WHERE deleted_at IS NULL;
-- 활성 루트 폴더 이름은 회원별로 대소문자를 구분하지 않고 유일해야 함
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_folder_root_name_ci
  ON "member_folder" ("owner_member_id", LOWER("folder_name"))
  WHERE "parent_folder_id" IS NULL AND "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS idx_member_folder_name ON "member_folder" ("folder_name");
CREATE INDEX IF NOT EXISTS idx_member_folder_created ON "member_folder" ("created_at");
CREATE INDEX IF NOT EXISTS idx_member_folder_deleted ON "member_folder" ("deleted_at");
-- 한 사용자당 시스템 폴더(UNORGANIZED)는 정확히 1개만 활성 상태로 존재
CREATE UNIQUE INDEX IF NOT EXISTS uq_member_folder_owner_unorganized
  ON "member_folder" ("owner_member_id")
  WHERE folder_type = 'UNORGANIZED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_member_tag_owner ON "member_tag" ("owner_member_id");
CREATE INDEX IF NOT EXISTS idx_member_tag_deleted_at ON "member_tag" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_team_name ON "team" ("team_name");
CREATE INDEX IF NOT EXISTS idx_team_owner ON "team" ("owner_member_id");
CREATE INDEX IF NOT EXISTS idx_team_deleted ON "team" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_team_folder_team ON "team_folder" ("team_id");
CREATE INDEX IF NOT EXISTS idx_team_folder_parent ON "team_folder" ("parent_folder_id");
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_folder_parent_name
  ON "team_folder" ("team_id", "parent_folder_id", "folder_name")
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_folder_name ON "team_folder" ("folder_name");
CREATE INDEX IF NOT EXISTS idx_team_folder_created_by ON "team_folder" ("created_by_member_id");
CREATE INDEX IF NOT EXISTS idx_team_folder_created ON "team_folder" ("created_at");
CREATE INDEX IF NOT EXISTS idx_team_folder_deleted ON "team_folder" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_tfp_team_folder ON "team_folder_permission" ("team_folder_id");
CREATE INDEX IF NOT EXISTS idx_tfp_member ON "team_folder_permission" ("member_id");
CREATE INDEX IF NOT EXISTS idx_tfp_permission ON "team_folder_permission" ("permission");

CREATE INDEX IF NOT EXISTS idx_team_member_team ON "team_member" ("team_id");
CREATE INDEX IF NOT EXISTS idx_team_member_member ON "team_member" ("member_id");
CREATE INDEX IF NOT EXISTS idx_team_member_role ON "team_member" ("role");

CREATE INDEX IF NOT EXISTS idx_team_saved_link_folder ON "team_saved_link" ("team_folder_id");
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_saved_link_folder_link
  ON "team_saved_link" ("team_folder_id", "link_id")
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_saved_link_link ON "team_saved_link" ("link_id");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_created_by ON "team_saved_link" ("created_by_member_id");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_title ON "team_saved_link" ("display_title");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_primary_category ON "team_saved_link" ("primary_category_id");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_categorized_at ON "team_saved_link" ("categorized_at");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_folder_sort ON "team_saved_link" ("team_folder_id", "sort_order");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_created_at ON "team_saved_link" ("created_at");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_deleted_at ON "team_saved_link" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_team_saved_link_tag_item ON "team_saved_link_tag" ("team_saved_link_id");
CREATE INDEX IF NOT EXISTS idx_team_saved_link_tag_tag ON "team_saved_link_tag" ("team_tag_id");

CREATE INDEX IF NOT EXISTS idx_team_tag_team ON "team_tag" ("team_id");

CREATE INDEX IF NOT EXISTS idx_link_enrichment_deleted_at ON "link_enrichment" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_oauth_member_member_id ON "oauth_member" ("member_id");
CREATE INDEX IF NOT EXISTS idx_oauth_member_provider ON "oauth_member" ("provider");
CREATE INDEX IF NOT EXISTS idx_oauth_member_deleted_at ON "oauth_member" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_member_folder_tag_item ON "member_folder_tag" ("member_folder_id");
CREATE INDEX IF NOT EXISTS idx_member_folder_tag_tag ON "member_folder_tag" ("member_tag_id");

CREATE UNIQUE INDEX IF NOT EXISTS uq_fsr_member_owner_category
  ON "folder_suggestion_rule" ("owner_member_id", "category_id")
  WHERE scope_type='member' AND is_active=true AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fsr_team_category
  ON "folder_suggestion_rule" ("team_id", "category_id")
  WHERE scope_type='team' AND is_active=true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fsr_scope ON "folder_suggestion_rule" ("scope_type");

CREATE UNIQUE INDEX IF NOT EXISTS uq_fsr_scope_owner_team_category_active
  ON "folder_suggestion_rule" ("scope_type", "owner_member_id", "team_id", "category_id")
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_fsr_owner ON "folder_suggestion_rule" ("owner_member_id");
CREATE INDEX IF NOT EXISTS idx_fsr_team ON "folder_suggestion_rule" ("team_id");
CREATE INDEX IF NOT EXISTS idx_fsr_category ON "folder_suggestion_rule" ("category_id");
CREATE INDEX IF NOT EXISTS idx_fsr_member_folder ON "folder_suggestion_rule" ("member_folder_id");
CREATE INDEX IF NOT EXISTS idx_fsr_team_folder ON "folder_suggestion_rule" ("team_folder_id");
CREATE INDEX IF NOT EXISTS idx_fsr_priority ON "folder_suggestion_rule" ("priority");
CREATE INDEX IF NOT EXISTS idx_fsr_active ON "folder_suggestion_rule" ("is_active");
CREATE INDEX IF NOT EXISTS idx_folder_suggestion_rule_deleted_at ON "folder_suggestion_rule" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_link_enrich_kw_enrichment ON "link_enrichment_keyword" ("link_enrichment_id");
CREATE INDEX IF NOT EXISTS idx_link_enrich_kw_keyword ON "link_enrichment_keyword" ("keyword");
CREATE INDEX IF NOT EXISTS idx_link_enrich_kw_created_at ON "link_enrichment_keyword" ("created_at");

CREATE UNIQUE INDEX IF NOT EXISTS uq_member_saved_link_folder_link
  ON "member_saved_link" ("member_folder_id", "link_id")
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_member_saved_link_link ON "member_saved_link" ("link_id");
CREATE INDEX IF NOT EXISTS idx_member_saved_link_enrichment ON "member_saved_link" ("link_enrichment_id");
CREATE INDEX IF NOT EXISTS idx_member_saved_link_folder ON "member_saved_link" ("member_folder_id");
CREATE INDEX IF NOT EXISTS idx_member_saved_link_title ON "member_saved_link" ("display_title");
CREATE INDEX IF NOT EXISTS idx_member_saved_link_primary_category ON "member_saved_link" ("primary_category_id");
CREATE INDEX IF NOT EXISTS idx_member_saved_link_created_at ON "member_saved_link" ("created_at");
CREATE INDEX IF NOT EXISTS idx_member_saved_link_deleted_at ON "member_saved_link" ("deleted_at");

CREATE INDEX IF NOT EXISTS idx_member_saved_link_tag_item ON "member_saved_link_tag" ("member_saved_link_id");
CREATE INDEX IF NOT EXISTS idx_member_saved_link_tag_tag ON "member_saved_link_tag" ("member_tag_id");

COMMIT;

-- Indexes for Legacy Tables
CREATE INDEX IF NOT EXISTS idx_website_url ON "website" ("url");
CREATE INDEX IF NOT EXISTS idx_website_category ON "website" ("category");

CREATE INDEX IF NOT EXISTS idx_board_member ON "board" ("member_member_id");
CREATE INDEX IF NOT EXISTS idx_board_title ON "board" ("title");
CREATE INDEX IF NOT EXISTS idx_board_created_date ON "board" ("created_date");

CREATE INDEX IF NOT EXISTS idx_comment_board ON "comment" ("board_board_id");
CREATE INDEX IF NOT EXISTS idx_comment_member ON "comment" ("member_member_id");

CREATE INDEX IF NOT EXISTS idx_likes_board ON "likes" ("board_board_id");
CREATE INDEX IF NOT EXISTS idx_likes_member ON "likes" ("member_member_id");

