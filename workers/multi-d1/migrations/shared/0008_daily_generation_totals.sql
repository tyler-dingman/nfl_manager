CREATE TABLE app_content_automation_totals(day INTEGER PRIMARY KEY,generated INTEGER NOT NULL CHECK(generated>=0)) WITHOUT ROWID;
INSERT INTO app_content_automation_totals(day,generated) SELECT CAST(started_at/86400000 AS INTEGER),sum(generated_items) FROM app_content_automation_runs WHERE trial_starts_at IS NULL GROUP BY CAST(started_at/86400000 AS INTEGER);
CREATE TRIGGER app_content_automation_total_insert AFTER INSERT ON app_content_automation_runs WHEN NEW.trial_starts_at IS NULL BEGIN
INSERT INTO app_content_automation_totals(day,generated) VALUES(CAST(NEW.started_at/86400000 AS INTEGER),NEW.generated_items) ON CONFLICT(day) DO UPDATE SET generated=generated+excluded.generated;
END;
