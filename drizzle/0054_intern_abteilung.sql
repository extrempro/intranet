ALTER TABLE "news" ADD COLUMN "team_scope" text;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_team_scope" CHECK (team_scope IS NULL OR team_scope IN ('mitglieder', 'stamm'));--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "team_scope" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_team_scope" CHECK (team_scope IS NULL OR team_scope IN ('mitglieder', 'stamm'));--> statement-breakpoint
ALTER TABLE "unit_document_folders" ADD COLUMN "intern" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Interne Beiträge (Kap. 8.17): zusätzlich zur Prüfung im Code sieht die App-Rolle
-- sie nur für Personen mit Zugang zum Team. Die Funktion läuft mit den Rechten
-- der Besitzer-Rolle, damit sie Team, Leitung und Rollen lesen kann.
CREATE FUNCTION app_team_zugang(einheit uuid, kreis text, autor uuid) RETURNS boolean
	LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
	SELECT kreis IS NULL
		OR autor = app_person_id()
		OR EXISTS (SELECT 1 FROM unit_members m WHERE m.unit_id = einheit AND m.person_id = app_person_id() AND (kreis = 'mitglieder' OR m.is_primary))
		OR EXISTS (SELECT 1 FROM units u WHERE u.id = einheit AND app_person_id() IN (u.lead_person_id, u.second_lead_person_id, u.deputy_person_id))
		OR EXISTS (SELECT 1 FROM role_assignments r WHERE r.person_id = app_person_id() AND r.role = 'abteilungsverwaltung' AND r.scope_unit_id = einheit)
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_team_zugang(uuid, text, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_team_zugang(uuid, text, uuid) TO intranet_app;--> statement-breakpoint
CREATE POLICY news_team ON news AS RESTRICTIVE FOR SELECT TO intranet_app
	USING (app_team_zugang(unit_id, team_scope, created_by));
