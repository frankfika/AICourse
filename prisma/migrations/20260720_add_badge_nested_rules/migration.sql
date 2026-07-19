-- 徽章嵌套规则 DSL 支持
-- 新加 criteriaJson 字段 (JSON),null 时 fallback 到旧 criteriaType + criteriaValue

ALTER TABLE `badges` ADD COLUMN `criteria_json` JSON NULL;
