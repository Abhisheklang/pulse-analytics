-- Pulse wave 2: delivery channels (Slack/Discord/Telegram), revenue currency, uptime monitoring
ALTER TABLE "pulse_site_setting" ADD COLUMN "revenue_currency" VARCHAR(10) NOT NULL DEFAULT 'USD';

ALTER TABLE "pulse_alert_rule" ADD COLUMN "channel" VARCHAR(20) NOT NULL DEFAULT 'webhook';
ALTER TABLE "pulse_alert_rule" ADD COLUMN "telegram_bot_token" VARCHAR(200);
ALTER TABLE "pulse_alert_rule" ADD COLUMN "telegram_chat_id" VARCHAR(100);

ALTER TABLE "pulse_alert_log" ADD COLUMN "channel" VARCHAR(20);
ALTER TABLE "pulse_alert_log" ADD COLUMN "delivery_status" INTEGER;

ALTER TABLE "pulse_report_schedule" ADD COLUMN "channel" VARCHAR(20) NOT NULL DEFAULT 'webhook';
ALTER TABLE "pulse_report_schedule" ADD COLUMN "telegram_bot_token" VARCHAR(200);
ALTER TABLE "pulse_report_schedule" ADD COLUMN "telegram_chat_id" VARCHAR(100);

ALTER TABLE "pulse_report_log" ADD COLUMN "channel" VARCHAR(20);
ALTER TABLE "pulse_report_log" ADD COLUMN "delivery_status" INTEGER;

CREATE TABLE "pulse_uptime_monitor" (
    "monitor_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "url" VARCHAR(1000) NOT NULL,
    "interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "notify_webhook_url" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "pulse_uptime_monitor_pkey" PRIMARY KEY ("monitor_id")
);
CREATE UNIQUE INDEX "pulse_uptime_monitor_website_id_key" ON "pulse_uptime_monitor"("website_id");

CREATE TABLE "pulse_uptime_check" (
    "check_id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "up" BOOLEAN NOT NULL DEFAULT false,
    "status" INTEGER,
    "response_ms" INTEGER NOT NULL DEFAULT 0,
    "error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_uptime_check_pkey" PRIMARY KEY ("check_id")
);
CREATE INDEX "pulse_uptime_check_website_id_created_at_idx" ON "pulse_uptime_check"("website_id", "created_at");
CREATE INDEX "pulse_uptime_check_monitor_id_created_at_idx" ON "pulse_uptime_check"("monitor_id", "created_at");

CREATE TABLE "pulse_uptime_incident" (
    "incident_id" UUID NOT NULL,
    "monitor_id" UUID NOT NULL,
    "website_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pulse_uptime_incident_pkey" PRIMARY KEY ("incident_id")
);
CREATE INDEX "pulse_uptime_incident_website_id_started_at_idx" ON "pulse_uptime_incident"("website_id", "started_at");
