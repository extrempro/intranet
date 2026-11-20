-- Globale Suche (Kap. 8.14): deutscher Volltext, Umlaute und Akzente egal
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'intranet_de') THEN
		CREATE TEXT SEARCH CONFIGURATION intranet_de (COPY = german);
		ALTER TEXT SEARCH CONFIGURATION intranet_de
			ALTER MAPPING FOR hword, hword_part, word WITH unaccent, german_stem;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'intranet_simple') THEN
		CREATE TEXT SEARCH CONFIGURATION intranet_simple (COPY = simple);
		ALTER TEXT SEARCH CONFIGURATION intranet_simple
			ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;
	END IF;
END $$;--> statement-breakpoint
-- Ausdrucksindizes: dieselben Ausdrücke wie in src/lib/server/fts.ts
CREATE INDEX IF NOT EXISTS news_fts ON news USING gin (
	(setweight(to_tsvector('intranet_de', title), 'A') || setweight(to_tsvector('intranet_de', body_text), 'B'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS faqs_fts ON faqs USING gin (
	(setweight(to_tsvector('intranet_de', question), 'A') || setweight(to_tsvector('intranet_de', answer_text), 'B'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_fts ON events USING gin (
	(setweight(to_tsvector('intranet_de', title), 'A') || setweight(to_tsvector('intranet_de', coalesce(place, '') || ' ' || coalesce(description, '')), 'B'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS board_ads_fts ON board_ads USING gin (
	(setweight(to_tsvector('intranet_de', title), 'A') || setweight(to_tsvector('intranet_de', body), 'B'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS persons_fts ON persons USING gin (
	(to_tsvector('intranet_simple', display_name || ' ' || coalesce(position, '')))
);
