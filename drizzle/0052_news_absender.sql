-- Absender von Neuigkeiten auch aus anderen Mandanten, wenn der Beitrag an
-- den eigenen Mandanten gerichtet ist (Redaktion, Kap. 10). Die Sicht läuft
-- mit den Rechten der Besitzer-Rolle; die Mandantenbedingung steht hier.
CREATE VIEW news_absender AS
	SELECT u.id, u.tenant_id, u.type, u.name, u.title, u.slug, u.is_central, u.archived_at
	FROM units u
	WHERE u.tenant_id = app_tenant_id()
		OR u.is_central
		OR EXISTS (
			SELECT 1 FROM news n
			WHERE n.unit_id = u.id
				AND (
					n.all_tenants
					OR EXISTS (
						SELECT 1 FROM news_tenants nt
						WHERE nt.news_id = n.id AND nt.tenant_id = app_tenant_id()
					)
				)
		);--> statement-breakpoint
GRANT SELECT ON news_absender TO intranet_app;
