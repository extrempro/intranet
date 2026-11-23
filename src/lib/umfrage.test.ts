import { describe, expect, it } from 'vitest';
import {
	ergebnisSichtbar,
	leseAntworten,
	leseUmfrage,
	MAX_FRAGEN,
	teamText,
	werSiehtWas,
	type FrageDef
} from './umfrage.ts';

const gueltig = {
	anonym: true,
	ergebnis: 'alle',
	ab: 'antwort',
	ende: '2099-01-10T12:00',
	fragen: [
		{ art: 'auswahl', text: 'Pizza oder Pasta?', pflicht: true, optionen: ['Pizza', 'Pasta'] }
	]
};

function form(werte: Record<string, string | string[]>) {
	return {
		get: (k: string) => {
			const v = werte[k];
			return Array.isArray(v) ? v[0] : (v ?? null);
		},
		getAll: (k: string) => {
			const v = werte[k];
			return v === undefined ? [] : Array.isArray(v) ? v : [v];
		}
	};
}

describe('leseUmfrage', () => {
	it('leer oder „null“ heißt keine Umfrage', () => {
		expect(leseUmfrage('')).toEqual({ wert: null });
		expect(leseUmfrage('null')).toEqual({ wert: null });
		expect(leseUmfrage(undefined)).toEqual({ wert: null });
	});

	it('kaputtes JSON gibt einen lesbaren Fehler', () => {
		expect(leseUmfrage('{').fehler).toBe('Die Umfrage ließ sich nicht lesen.');
	});

	it('gültige Umfrage, Standard anonym, unbekannte Werte auf sichere Vorgaben', () => {
		const r = leseUmfrage(JSON.stringify({ ...gueltig, anonym: 'ja', ab: 'irgendwann' }));
		expect(r.fehler).toBeUndefined();
		expect(r.wert).toMatchObject({ anonym: true, ab: 'antwort', ergebnis: 'alle' });
		expect(r.wert!.fragen[0]).toMatchObject({ art: 'auswahl', pflicht: true, mehrfach: false });
	});

	it('Mehrfachauswahl nur bei Auswahl, Optionen nur bei Auswahl und Termin', () => {
		const r = leseUmfrage(
			JSON.stringify({
				...gueltig,
				fragen: [{ art: 'bewertung', text: 'Wie war es?', mehrfach: true, optionen: ['x', 'y'] }]
			})
		);
		expect(r.wert!.fragen[0]).toMatchObject({ mehrfach: false, optionen: [] });
	});

	it('prüft Inhalte', () => {
		const mit = (f: object) => leseUmfrage(JSON.stringify({ ...gueltig, ...f })).fehler;
		expect(mit({ fragen: [] })).toMatch(/mindestens eine Frage/);
		expect(mit({ fragen: [{ art: 'freitext', text: '' }] })).toMatch(/Frage 1: Bitte gib/);
		expect(mit({ fragen: [{ art: 'auswahl', text: 'A?', optionen: ['nur eine'] }] })).toMatch(
			/Mindestens zwei/
		);
		expect(mit({ fragen: [{ art: 'termin', text: 'Wann?', optionen: ['Mo', 'mo'] }] })).toMatch(
			/doppelt/
		);
		expect(mit({ fragen: [{ art: 'auswahl', text: 'A?', optionen: ['a', ''] }] })).toMatch(
			/Leere Antworten/
		);
		expect(mit({ ende: '' })).toMatch(/Ende/);
		const viele = Array.from({ length: MAX_FRAGEN + 1 }, () => ({ art: 'freitext', text: 'x' }));
		expect(mit({ fragen: viele })).toMatch(/Höchstens 15 Fragen/);
	});

	it('kürzt überlange Texte', () => {
		const r = leseUmfrage(
			JSON.stringify({ ...gueltig, fragen: [{ art: 'freitext', text: 'x'.repeat(500) }] })
		);
		expect(r.wert!.fragen[0].text).toHaveLength(200);
	});
});

describe('leseAntworten', () => {
	const fragen: FrageDef[] = [
		{ id: 'a', art: 'auswahl', pflicht: true, mehrfach: false, optionen: ['x', 'y', 'z'] },
		{ id: 'm', art: 'auswahl', pflicht: false, mehrfach: true, optionen: ['x', 'y', 'z'] },
		{ id: 't', art: 'termin', pflicht: true, mehrfach: false, optionen: ['Mo', 'Di'] },
		{ id: 'b', art: 'bewertung', pflicht: false, mehrfach: false, optionen: [] },
		{ id: 'f', art: 'freitext', pflicht: false, mehrfach: false, optionen: [] }
	];

	it('liest alle Arten', () => {
		const r = leseAntworten(
			fragen,
			form({
				'q-a': '1',
				'q-m': ['2', '0', '2'],
				'q-t-0': 'ja',
				'q-t-1': 'vielleicht',
				'q-b': '4',
				'q-f': '  Danke!  '
			})
		);
		expect(r.fehlend).toEqual([]);
		expect(Object.fromEntries(r.werte)).toEqual({
			a: [1],
			m: [0, 2],
			t: ['ja', 'vielleicht'],
			b: 4,
			f: 'Danke!'
		});
	});

	it('meldet fehlende Pflichtfragen, ungültige Werte zählen als fehlend', () => {
		const r = leseAntworten(
			fragen,
			form({ 'q-a': '7', 'q-t-0': 'ja', 'q-t-1': 'egal', 'q-b': '9' })
		);
		expect(r.fehlend).toEqual(['a', 't']);
		expect(r.werte.size).toBe(0);
	});

	it('Einfachauswahl nimmt nur eine Antwort', () => {
		const r = leseAntworten([fragen[0]], form({ 'q-a': ['2', '1'] }));
		expect(r.werte.get('a')).toEqual([1]);
	});

	it('Freitext höchstens 500 Zeichen', () => {
		const r = leseAntworten([fragen[4]], form({ 'q-f': 'x'.repeat(900) }));
		expect(String(r.werte.get('f'))).toHaveLength(500);
	});
});

describe('ergebnisSichtbar', () => {
	const basis = { team: false, teilgenommen: false, beendet: false } as const;
	it('Team sieht immer', () => {
		expect(ergebnisSichtbar({ ...basis, team: true, ergebnis: 'team', ab: 'ende' })).toBe(true);
	});
	it('nur Team: andere nie, auch nicht nach dem Ende', () => {
		expect(
			ergebnisSichtbar({ ...basis, ergebnis: 'team', ab: 'sofort', teilgenommen: true, beendet: true })
		).toBe(false);
	});
	it('alle: sofort, nach Antwort oder nach Ende', () => {
		expect(ergebnisSichtbar({ ...basis, ergebnis: 'alle', ab: 'sofort' })).toBe(true);
		expect(ergebnisSichtbar({ ...basis, ergebnis: 'alle', ab: 'antwort' })).toBe(false);
		expect(
			ergebnisSichtbar({ ...basis, ergebnis: 'alle', ab: 'antwort', teilgenommen: true })
		).toBe(true);
		expect(
			ergebnisSichtbar({ ...basis, ergebnis: 'alle', ab: 'ende', teilgenommen: true })
		).toBe(false);
		expect(ergebnisSichtbar({ ...basis, ergebnis: 'alle', ab: 'ende', beendet: true })).toBe(true);
	});
});

describe('werSiehtWas', () => {
	it('nennt das Team und sagt bei anonym klar, dass niemand zuordnen kann', () => {
		const z = werSiehtWas({
			anonym: true,
			ergebnis: 'team',
			ab: 'antwort',
			team: teamText('Kantine'),
			ende: '10.01.'
		});
		expect(z.map((x) => x.was)).toHaveLength(4);
		expect(z[0].wer).toMatch(/Niemand kann sie dir zuordnen, auch nicht das Team von Kantine/);
		expect(z[1].wer).toMatch(/^Nur das Team von Kantine/);
		expect(z[2].wer).toMatch(/ohne Namen/);
	});
	it('mit Namen: Team sieht Namen', () => {
		const z = werSiehtWas({
			anonym: false,
			ergebnis: 'alle',
			ab: 'ende',
			team: teamText('Kantine'),
			ende: '10.01.'
		});
		expect(z[0].wer).toMatch(/^Das Team von Kantine sieht deinen Namen/);
		expect(z[1].wer).toMatch(/nach dem Ende \(10\.01\.\)/);
		expect(z[3].wer).toMatch(/sieht, wer teilgenommen hat/);
	});
});
