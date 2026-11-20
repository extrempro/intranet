-- Eingeschränkte Rolle für die Anwendung (Kap. 16: Mandantentrennung auch in der DB).
-- Das Passwort setzt die Anwendung beim Start aus APP_DATABASE_PASSWORD.
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intranet_app') THEN
		CREATE ROLE intranet_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
	END IF;
END
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO intranet_app;--> statement-breakpoint

-- Nur Inhaltstabellen. Kein Zugriff auf local_credentials, passkeys,
-- recovery_codes, invitations, pending_logins, sessions, audit_log, settings,
-- role_assignments, entra_group_roles.
GRANT SELECT ON tenants, tenant_domains TO intranet_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON units, unit_members TO intranet_app;--> statement-breakpoint
GRANT SELECT ON persons TO intranet_app;--> statement-breakpoint
GRANT UPDATE (position, phone, mobile, mobile_visibility, room, updated_at) ON persons TO intranet_app;--> statement-breakpoint

-- Hilfsfunktionen: leere Einstellung = NULL, damit ohne Kontext nichts passt
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS
	$$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_person_id() RETURNS uuid LANGUAGE sql STABLE AS
	$$ SELECT nullif(current_setting('app.person_id', true), '')::uuid $$;--> statement-breakpoint

-- Einheiten: eigener Mandant oder zentral; schreiben nur im eigenen Mandanten
ALTER TABLE units ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY units_select ON units FOR SELECT TO intranet_app
	USING (tenant_id = app_tenant_id() OR is_central);--> statement-breakpoint
CREATE POLICY units_write ON units FOR ALL TO intranet_app
	USING (tenant_id = app_tenant_id())
	WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint

-- Team-Einträge folgen der Sichtbarkeit ihrer Einheit
ALTER TABLE unit_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY unit_members_select ON unit_members FOR SELECT TO intranet_app
	USING (EXISTS (SELECT 1 FROM units u WHERE u.id = unit_id));--> statement-breakpoint
CREATE POLICY unit_members_write ON unit_members FOR ALL TO intranet_app
	USING (EXISTS (SELECT 1 FROM units u WHERE u.id = unit_id AND u.tenant_id = app_tenant_id()))
	WITH CHECK (EXISTS (SELECT 1 FROM units u WHERE u.id = unit_id AND u.tenant_id = app_tenant_id()));--> statement-breakpoint

-- Personen: eigener Mandant, man selbst, oder Mitglied einer zentralen Einheit
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY persons_select ON persons FOR SELECT TO intranet_app
	USING (
		tenant_id = app_tenant_id()
		OR id = app_person_id()
		OR EXISTS (
			SELECT 1 FROM unit_members m JOIN units u ON u.id = m.unit_id
			WHERE m.person_id = persons.id AND u.is_central
		)
	);--> statement-breakpoint
CREATE POLICY persons_update_self ON persons FOR UPDATE TO intranet_app
	USING (id = app_person_id())
	WITH CHECK (id = app_person_id());
