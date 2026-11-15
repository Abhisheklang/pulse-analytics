-- Pulse wave 4: built-in scheduler, SMTP email settings, onboarding state
ALTER TABLE "pulse_alert_rule" ADD COLUMN "email_to" VARCHAR(320);

CREATE TABLE "pulse_settings" (
    "settings_id" VARCHAR(50) NOT NULL,
    "smtp_host" VARCHAR(255),
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT false,
    "smtp_user" VARCHAR(255),
    "smtp_password" VARCHAR(500),
    "smtp_from_name" VARCHAR(100),
    "smtp_from_email" VARCHAR(320),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_settings_pkey" PRIMARY KEY ("settings_id")
);

CREATE TABLE "pulse_scheduler_config" (
    "config_id" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "alerts_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "reports_interval_minutes" INTEGER NOT NULL DEFAULT 1,
    "retention_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_scheduler_config_pkey" PRIMARY KEY ("config_id")
);

CREATE TABLE "pulse_scheduler_state" (
    "job" VARCHAR(30) NOT NULL,
    "last_run_at" TIMESTAMPTZ(6),
    "next_due_at" TIMESTAMPTZ(6),
    "last_result" VARCHAR(500),
    "lease_owner" VARCHAR(100),
    "lease_expires_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_scheduler_state_pkey" PRIMARY KEY ("job")
);

CREATE TABLE "pulse_scheduler_log" (
    "log_id" UUID NOT NULL,
    "job" VARCHAR(30) NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "items" INTEGER NOT NULL DEFAULT 0,
    "detail" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_scheduler_log_pkey" PRIMARY KEY ("log_id")
);
CREATE INDEX "pulse_scheduler_log_job_created_at_idx" ON "pulse_scheduler_log"("job", "created_at");

CREATE TABLE "pulse_onboarding" (
    "user_id" UUID NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "password_changed" BOOLEAN NOT NULL DEFAULT false,
    "snippet_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_onboarding_pkey" PRIMARY KEY ("user_id")
);
