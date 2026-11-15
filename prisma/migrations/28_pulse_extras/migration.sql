-- Pulse extras: additive tables for alerts, reports, privacy, badge, webhooks, imports
CREATE TABLE "pulse_site_setting" (
    "website_id" UUID NOT NULL,
    "retention_days" INTEGER NOT NULL DEFAULT 0,
    "badge_enabled" BOOLEAN NOT NULL DEFAULT false,
    "badge_token" VARCHAR(100),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_site_setting_pkey" PRIMARY KEY ("website_id")
);
CREATE TABLE "pulse_alert_rule" (
    "rule_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "metric" VARCHAR(20) NOT NULL DEFAULT 'pageviews',
    "condition" VARCHAR(20) NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "window_hours" INTEGER NOT NULL DEFAULT 24,
    "webhook_url" VARCHAR(1000) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_fired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_alert_rule_pkey" PRIMARY KEY ("rule_id")
);
CREATE INDEX "pulse_alert_rule_website_id_idx" ON "pulse_alert_rule"("website_id");
CREATE TABLE "pulse_alert_log" (
    "log_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "fired" BOOLEAN NOT NULL DEFAULT false,
    "message" VARCHAR(1000) NOT NULL,
    "current_value" DOUBLE PRECISION,
    "baseline_value" DOUBLE PRECISION,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_alert_log_pkey" PRIMARY KEY ("log_id")
);
CREATE INDEX "pulse_alert_log_website_id_created_at_idx" ON "pulse_alert_log"("website_id", "created_at");
CREATE INDEX "pulse_alert_log_rule_id_idx" ON "pulse_alert_log"("rule_id");
CREATE TABLE "pulse_report_schedule" (
    "schedule_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "frequency" VARCHAR(20) NOT NULL DEFAULT 'weekly',
    "webhook_url" VARCHAR(1000),
    "email" VARCHAR(320),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_report_schedule_pkey" PRIMARY KEY ("schedule_id")
);
CREATE INDEX "pulse_report_schedule_website_id_idx" ON "pulse_report_schedule"("website_id");
CREATE TABLE "pulse_report_log" (
    "log_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "summary" JSONB NOT NULL,
    "csv" TEXT,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_report_log_pkey" PRIMARY KEY ("log_id")
);
CREATE INDEX "pulse_report_log_website_id_created_at_idx" ON "pulse_report_log"("website_id", "created_at");
CREATE TABLE "pulse_webhook_config" (
    "website_id" UUID NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "events" VARCHAR(20) NOT NULL DEFAULT 'all',
    "secret" VARCHAR(200),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_webhook_config_pkey" PRIMARY KEY ("website_id")
);
CREATE TABLE "pulse_webhook_delivery" (
    "delivery_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "event_type" INTEGER NOT NULL DEFAULT 1,
    "event_name" VARCHAR(50),
    "url_path" VARCHAR(500),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER,
    "error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_webhook_delivery_pkey" PRIMARY KEY ("delivery_id")
);
CREATE INDEX "pulse_webhook_delivery_website_id_created_at_idx" ON "pulse_webhook_delivery"("website_id", "created_at");
CREATE TABLE "pulse_import_log" (
    "import_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "rows_imported" INTEGER NOT NULL DEFAULT 0,
    "rows_skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_import_log_pkey" PRIMARY KEY ("import_id")
);
CREATE INDEX "pulse_import_log_website_id_created_at_idx" ON "pulse_import_log"("website_id", "created_at");
