-- Pulse wave 3: A/B testing, custom dashboards, warehouse exports, admin audit log
CREATE TABLE "pulse_experiment" (
    "experiment_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "conversion_event" VARCHAR(100) NOT NULL,
    "variants" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_experiment_pkey" PRIMARY KEY ("experiment_id")
);
CREATE UNIQUE INDEX "pulse_experiment_website_id_key_key" ON "pulse_experiment"("website_id", "key");
CREATE INDEX "pulse_experiment_website_id_idx" ON "pulse_experiment"("website_id");

CREATE TABLE "pulse_dashboard" (
    "dashboard_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "layout" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_dashboard_pkey" PRIMARY KEY ("dashboard_id")
);
CREATE INDEX "pulse_dashboard_user_id_idx" ON "pulse_dashboard"("user_id");

CREATE TABLE "pulse_export_job" (
    "job_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "destination" VARCHAR(20) NOT NULL,
    "format" VARCHAR(10) NOT NULL DEFAULT 'ndjson',
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_export_job_pkey" PRIMARY KEY ("job_id")
);
CREATE INDEX "pulse_export_job_website_id_idx" ON "pulse_export_job"("website_id");

CREATE TABLE "pulse_export_log" (
    "log_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "destination" VARCHAR(20) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "rows_exported" INTEGER NOT NULL DEFAULT 0,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "error" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_export_log_pkey" PRIMARY KEY ("log_id")
);
CREATE INDEX "pulse_export_log_website_id_created_at_idx" ON "pulse_export_log"("website_id", "created_at");
CREATE INDEX "pulse_export_log_job_id_idx" ON "pulse_export_log"("job_id");

CREATE TABLE "pulse_audit_log" (
    "log_id" UUID NOT NULL,
    "user_id" UUID,
    "username" VARCHAR(100),
    "action" VARCHAR(50) NOT NULL,
    "website_id" UUID,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_audit_log_pkey" PRIMARY KEY ("log_id")
);
CREATE INDEX "pulse_audit_log_created_at_idx" ON "pulse_audit_log"("created_at");
CREATE INDEX "pulse_audit_log_action_created_at_idx" ON "pulse_audit_log"("action", "created_at");
