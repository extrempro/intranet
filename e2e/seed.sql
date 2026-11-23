-- Testdaten für die Browser-Tests (nur CI und lokal, nie im Betrieb).
-- Zwei Mandanten, eine Abteilung, zwei Hubs und vier Personen mit festen
-- Sitzungen. Das Cookie enthält das Token, die Datenbank nur dessen SHA-256.
insert into tenants (id, name, short_name, is_main) values
	('00000000-0000-4000-8000-000000000001', 'Beispielhaus', 'BH', true),
	('00000000-0000-4000-8000-000000000002', 'Zweithaus', 'ZH', false);

insert into units (id, tenant_id, type, name, slug, is_central, about) values
	('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'abteilung', 'IT', 'it', true, null),
	('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'hub', 'Chor', 'chor', true, 'Proben und Auftritte des Betriebschors'),
	('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'hub', 'Laufgruppe', 'laufgruppe', false, 'Gemeinsam laufen nach Feierabend');

insert into persons (id, tenant_id, email, display_name, auth_source, position) values
	('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', 'ada@haus-a.test', 'Ada Admin', 'local', 'IT-Leitung'),
	('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', 'nils@haus-a.test', 'Nils Normal', 'local', 'Bühnentechnik'),
	('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000001', 'hanna@haus-a.test', 'Hanna Hub', 'local', 'Kostüm'),
	('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-000000000002', 'bea@zweithaus.test', 'Bea Bauer', 'local', 'Tanz');

insert into role_assignments (person_id, role, scope) values
	('00000000-0000-4000-8000-0000000000c1', 'system_admin', 'all');
insert into role_assignments (person_id, role, scope, scope_unit_id) values
	('00000000-0000-4000-8000-0000000000c3', 'hub_team', 'unit', '00000000-0000-4000-8000-0000000000b1');

insert into unit_members (unit_id, person_id, is_primary, may_write_news) values
	('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', true, true),
	('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c2', true, false),
	('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c3', false, false);

-- Mediathek: ein Thema, ein veröffentlichtes Video (nur Beispielhaus), ein Entwurf im Chor
insert into topics (id, name) values ('00000000-0000-4000-8000-0000000000e1', 'Software');
insert into videos (id, unit_id, title, description, status, tenant_ids, key_enc, bytes, duration_sec, heights, captions_vtt, captions_text, chapters, created_by, published_at) values
	('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'Drucker einrichten', 'So richtest du den Drucker ein.', 'veroeffentlicht', '{00000000-0000-4000-8000-000000000001}', 'x', 1000, 125, '{360}', E'WEBVTT\n\n00:00.000 --> 00:02.000\nHallo\n', 'Hallo', '[{"s":0,"t":"Einleitung"},{"s":60,"t":"Treiber"}]', '00000000-0000-4000-8000-0000000000c1', now()),
	('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000b1', 'Probe im Entwurf', '', 'entwurf', null, 'x', 1000, 60, '{360}', null, '', '[]', '00000000-0000-4000-8000-0000000000c3', null);
insert into video_topics (video_id, topic_id) values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1');

-- Einführungen und „Neu in Version“ als gesehen, damit nichts die Seiten überdeckt
insert into person_preferences (person_id, help_seen, version_hint)
select id, '["fuehrung","seite:neuigkeiten","seite:kalender","seite:brett","seite:nachrichten","rolle:abteilungsverwaltung","rolle:hub_team","rolle:redaktion","rolle:moderation"]'::jsonb, false
from persons;

insert into sessions (id, person_id, auth_method, expires_at)
select encode(sha256(convert_to('e2e-' || split_part(email, '@', 1), 'UTF8')), 'hex'), id, 'local', now() + interval '1 day'
from persons;

-- Umfragen eingeschaltet (in der Verwaltung voreingestellt aus)
insert into settings (key, value) values ('regeln.inhalte', '{"surveys": true}')
on conflict (key) do update set value = settings.value || excluded.value;
update units set surveys = true where id = '00000000-0000-4000-8000-0000000000b1';
