/**
 * Bewertung des Sicherungszustands (Kap. 18) für Verwaltung → System und die
 * Meldung an System-Admins. Ohne Ein-/Ausgabe, damit testbar.
 * Quelle: Statusdateien des Backup-Containers (backup/sicherung.sh).
 */

export interface LetzteSicherung {
	zeit: string;
	ok: boolean;
	name: string;
	dauer_s: number;
	meldung: string;
	erfolg_epoch: number;
	aufbewahrung_tage: number;
	test_alle_tage: number;
	uhrzeit: string;
	empfaenger: number;
}

export interface LetzterTest {
	zeit: string;
	epoch: number;
	ok: boolean;
	name: string;
	dauer_s: number;
	tabellen: number;
	personen: number;
	dateien: number;
	fehlende_dateien: number;
	meldung: string;
}

export interface SicherungInhalt {
	name: string;
	zeit: string;
	db_bytes: number;
	dateien: number;
	dateien_bytes: number;
}

export interface Befund {
	stufe: 'fehler' | 'warnung';
	text: string;
}

const STUNDE = 3600;

/** Sicherungen laufen täglich; ab 26 Stunden ohne Erfolg ist etwas faul. */
export const MAX_ALTER_S = 26 * STUNDE;

export function bewerteSicherung(
	sicherung: LetzteSicherung | null,
	test: LetzterTest | null,
	jetzt = Date.now()
): Befund[] {
	const nowS = Math.floor(jetzt / 1000);
	const befunde: Befund[] = [];
	if (!sicherung) {
		befunde.push({ stufe: 'fehler', text: 'Es gibt noch keine Sicherung.' });
		return befunde;
	}
	if (!sicherung.ok)
		befunde.push({
			stufe: 'fehler',
			text: `Die letzte Sicherung ist fehlgeschlagen${sicherung.meldung ? `: ${sicherung.meldung}` : '.'}`
		});
	if (!sicherung.erfolg_epoch)
		befunde.push({ stufe: 'fehler', text: 'Es gibt noch keine erfolgreiche Sicherung.' });
	else if (nowS - sicherung.erfolg_epoch > MAX_ALTER_S)
		befunde.push({
			stufe: 'fehler',
			text: `Die letzte erfolgreiche Sicherung ist älter als ${Math.floor((nowS - sicherung.erfolg_epoch) / STUNDE)} Stunden.`
		});

	const testTage = sicherung.test_alle_tage || 7;
	if (!test) befunde.push({ stufe: 'warnung', text: 'Es gab noch keinen Wiederherstellungstest.' });
	else {
		if (!test.ok)
			befunde.push({
				stufe: 'fehler',
				text: `Der Wiederherstellungstest ist fehlgeschlagen${test.meldung ? `: ${test.meldung}` : '.'}`
			});
		else if (test.fehlende_dateien > 0)
			befunde.push({ stufe: 'warnung', text: test.meldung || 'Einzelne Dateien fehlen.' });
		if (nowS - test.epoch > (testTage + 1) * 24 * STUNDE)
			befunde.push({
				stufe: 'warnung',
				text: `Der letzte Wiederherstellungstest ist älter als ${testTage + 1} Tage.`
			});
	}
	return befunde;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 300) : '');

/** Statusdateien sind Eingaben von außen: nur bekannte Felder mit passendem Typ. */
export function leseSicherung(raw: unknown): LetzteSicherung | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	return {
		zeit: str(r.zeit),
		ok: r.ok === true,
		name: str(r.name),
		dauer_s: num(r.dauer_s),
		meldung: str(r.meldung),
		erfolg_epoch: num(r.erfolg_epoch),
		aufbewahrung_tage: num(r.aufbewahrung_tage),
		test_alle_tage: num(r.test_alle_tage),
		uhrzeit: str(r.uhrzeit),
		empfaenger: num(r.empfaenger)
	};
}

export function leseTest(raw: unknown): LetzterTest | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	return {
		zeit: str(r.zeit),
		epoch: num(r.epoch),
		ok: r.ok === true,
		name: str(r.name),
		dauer_s: num(r.dauer_s),
		tabellen: num(r.tabellen),
		personen: num(r.personen),
		dateien: num(r.dateien),
		fehlende_dateien: num(r.fehlende_dateien),
		meldung: str(r.meldung)
	};
}

export function leseListe(raw: unknown): SicherungInhalt[] {
	if (!Array.isArray(raw)) return [];
	return raw.slice(0, 400).flatMap((e) => {
		if (!e || typeof e !== 'object') return [];
		const r = e as Record<string, unknown>;
		const name = str(r.name);
		if (!/^\d{4}-\d{2}-\d{2}_\d{6}$/.test(name)) return [];
		return [
			{
				name,
				zeit: str(r.zeit),
				db_bytes: num(r.db_bytes),
				dateien: num(r.dateien),
				dateien_bytes: num(r.dateien_bytes)
			}
		];
	});
}

export function groesse(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let v = bytes / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toLocaleString('de-DE', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`;
}
