-- Neuigkeiten: Lesen mit der App-Rolle, Mandantentrennung per RLS (Kap. 16).
-- Geschrieben wird mit der Besitzer-Rolle nach Rechteprüfung im Code.
GRANT SELECT ON news, news_tenants, urgent_dismissals TO intranet_app;--> statement-breakpoint

ALTER TABLE news ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY news_select ON news FOR SELECT TO intranet_app
	USING (
		all_tenants
		OR tenant_id = app_tenant_id()
		OR EXISTS (SELECT 1 FROM news_tenants nt WHERE nt.news_id = news.id AND nt.tenant_id = app_tenant_id())
	);--> statement-breakpoint

ALTER TABLE news_tenants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY news_tenants_select ON news_tenants FOR SELECT TO intranet_app
	USING (tenant_id = app_tenant_id());--> statement-breakpoint

-- Zugeklappte Banner: nur die eigenen
ALTER TABLE urgent_dismissals ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY urgent_dismissals_select ON urgent_dismissals FOR SELECT TO intranet_app
	USING (person_id = app_person_id());
