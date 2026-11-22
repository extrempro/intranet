-- Testdaten für die Browser-Tests (nur CI und lokal, nie im Betrieb).
-- Zwei Mandanten, eine Abteilung, zwei Hubs und vier Personen mit festen
-- Sitzungen. Das Cookie enthält das Token, die Datenbank nur dessen SHA-256.
insert into tenants (id, name, short_name, is_main) values
	('00000000-0000-4000-8000-000000000001', 'Staatsoper Hamburg', 'HSO', true),
	('00000000-0000-4000-8000-000000000002', 'Hamburg Ballett', 'HB', false);

insert into units (id, tenant_id, type, name, slug, is_central, about) values
	('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'abteilung', 'IT', 'it', true, null),
	('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'hub', 'Chor', 'chor', true, 'Proben und Auftritte des Betriebschors'),
	('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'hub', 'Laufgruppe', 'laufgruppe', false, 'Gemeinsam laufen nach Feierabend');

insert into persons (id, tenant_id, email, display_name, auth_source, position) values
	('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'ada@oper.test', 'Ada Admin', 'local', 'IT-Leitung'),
	('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', 'nils@oper.test', 'Nils Normal', 'local', 'Bühnentechnik'),
	('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001', 'hanna@oper.test', 'Hanna Hub', 'local', 'Kostüm'),
	('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-000000000002', 'bea@ballett.test', 'Bea Bauer', 'local', 'Tanz');

insert into role_assignments (person_id, role, scope) values
	('00000000-0000-4000-8000-0000000000c1', 'system_admin', 'all');
insert into role_assignments (person_id, role, scope, scope_unit_id) values
	('00000000-0000-4000-8000-0000000000c3', 'hub_team', 'unit', '00000000-0000-4000-8000-0000000000b1');

insert into unit_members (unit_id, person_id, is_primary, may_write_news) values
	('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', true, true),
	('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c2', true, false),
	('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c3', false, false);

-- Einführungen und „Neu in Version“ als gesehen, damit nichts die Seiten überdeckt
insert into person_preferences (person_id, help_seen, version_hint)
select id, '["fuehrung","seite:neuigkeiten","seite:kalender","seite:brett","seite:nachrichten","rolle:abteilungsverwaltung","rolle:hub_team","rolle:redaktion","rolle:moderation"]'::jsonb, false
from persons;

insert into sessions (id, person_id, auth_method, expires_at)
select encode(sha256(convert_to('e2e-' || split_part(email, '@', 1), 'UTF8')), 'hex'), id, 'local', now() + interval '1 day'
from persons;
