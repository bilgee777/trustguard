CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE TABLE users (
        id uuid NOT NULL,
        email character varying(254) NOT NULL,
        display_name character varying(80) NOT NULL,
        password_hash character varying(512) NOT NULL,
        created_at timestamp with time zone NOT NULL,
        last_login_at timestamp with time zone,
        failed_login_count integer NOT NULL,
        locked_until timestamp with time zone,
        history_mode character varying(20) NOT NULL,
        retention_days integer NOT NULL,
        CONSTRAINT pk_users PRIMARY KEY (id),
        CONSTRAINT ck_users_retention_days CHECK (retention_days BETWEEN 1 AND 3650)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE TABLE analyses (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        content_type character varying(20) NOT NULL,
        score integer NOT NULL,
        level character varying(20) NOT NULL,
        confidence_level character varying(20) NOT NULL,
        confidence_value integer NOT NULL,
        engine_version character varying(20) NOT NULL,
        categories text[] NOT NULL,
        rule_ids text[] NOT NULL,
        finding_titles character varying(4000) NOT NULL,
        redacted_text text,
        result_json jsonb,
        CONSTRAINT pk_analyses PRIMARY KEY (id),
        CONSTRAINT ck_analyses_confidence CHECK (confidence_value BETWEEN 0 AND 100),
        CONSTRAINT ck_analyses_score CHECK (score BETWEEN 0 AND 100),
        CONSTRAINT fk_analyses_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE TABLE refresh_tokens (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        token_hash character varying(64) NOT NULL,
        family_id uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        revoked_at timestamp with time zone,
        replaced_by_id uuid,
        CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
        CONSTRAINT fk_refresh_tokens_users_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE INDEX ix_analyses_expires_at ON analyses (expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE INDEX ix_analyses_user_id_created_at ON analyses (user_id, created_at DESC);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE INDEX ix_analyses_user_id_level_created_at ON analyses (user_id, level, created_at DESC);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE INDEX ix_refresh_tokens_family_id ON refresh_tokens (family_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON refresh_tokens (token_hash);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE INDEX ix_refresh_tokens_user_id_expires_at ON refresh_tokens (user_id, expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    CREATE UNIQUE INDEX ix_users_email ON users (email);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "migration_id" = '20261124204534_Initial') THEN
    INSERT INTO "__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261124204534_Initial', '10.0.15');
    END IF;
END $EF$;
COMMIT;

