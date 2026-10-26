-- 后台可开关定时采集；默认开启，保持原有行为
ALTER TABLE "AgentSetting" ADD COLUMN "cronEnabled" BOOLEAN NOT NULL DEFAULT true;
