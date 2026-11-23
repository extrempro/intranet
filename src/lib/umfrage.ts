/**
 * Umfragen an Beiträgen (Kap. 8.16): Eingaben aus dem Editor und Antworten
 * prüfen. Rein und getestet; gespeichert wird in server/umfragen.ts.
 */

export type FrageArt = 'auswahl' | 'termin' | 'bewertung' | 'freitext';
export type TerminWahl = 'ja' | 'vielleicht' | 'nein';
export type Ergebnis = 'alle' | 'team';
export type ErgebnisAb = 'sofort' | 'antwort' | 'ende';

export const FRAGE_ARTEN: Record<FrageArt, string> = {
	auswahl: 'Auswahl',
	termin: 'Terminfindung',
	bewertung: 'Bewertung',
	freitext: 'Freitext'
};
export const TERMIN_WAHL: Record<TerminWahl, string> = {
	ja: 'Passt',
	vielleicht: 'Vielleicht',
	nein: 'Passt nicht'
};
export const STERNE_TEXT = [
	'',
	'gar nicht zufrieden',
	'eher nicht zufrieden',
	'teils, teils',
	'zufrieden',
	'sehr zufrieden'
];

export const MAX_FRAGEN = 15;
export const MAX_OPTIONEN = 10;
export const MAX_FREITEXT = 500;

export interface FrageEingabe {
	art: FrageArt;
	text: string;
	pflicht: boolean;
	mehrfach: boolean;
	optionen: string[];
}

export interface UmfrageEingabe {
	anonym: boolean;
	ergebnis: Ergebnis;
	ab: ErgebnisAb;
	/** Ende als „JJJJ-MM-TTTHH:MM“ (Europe/Berlin) */
	ende: string;
	fragen: FrageEingabe[];
}

export function leereFrage(art: FrageArt): FrageEingabe {
	return {
		art,
		text: '',
		pflicht: art !== 'freitext',
		mehrfach: false,
		optionen: art === 'auswahl' || art === 'termin' ? ['', ''] : []
	};
}

const ARTEN = Object.keys(FRAGE_ARTEN) as FrageArt[];
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Liest die Umfrage aus dem versteckten Feld des Beitragsformulars.
 * Leer oder „null“: keine Umfrage. Fehler als lesbarer Satz.
 */
export function leseUmfrage(roh: string | null | undefined): {
	wert: UmfrageEingabe | null;
	fehler?: string;
} {
	if (!roh || roh === 'null') return { wert: null };
	let d: Record<string, unknown>;
	try {
		d = JSON.parse(roh);
	} catch {
		return { wert: null, fehler: 'Die Umfrage ließ sich nicht lesen.' };
	}
	if (!d || typeof d !== 'object') return { wert: null };
	const fragenRoh = Array.isArray(d.fragen) ? d.fragen : [];
	const wert: UmfrageEingabe = {
		anonym: d.anonym !== false,
		ergebnis: d.ergebnis === 'team' ? 'team' : 'alle',
		ab: d.ab === 'sofort' || d.ab === 'ende' ? d.ab : 'antwort',
		ende: text(d.ende, 16),
		fragen: fragenRoh.slice(0, MAX_FRAGEN + 1).map((f: Record<string, unknown>) => {
			const art = ARTEN.includes(f?.art as FrageArt) ? (f.art as FrageArt) : 'auswahl';
			return {
				art,
				text: text(f?.text, 200),
				pflicht: f?.pflicht === true,
				mehrfach: art === 'auswahl' && f?.mehrfach === true,
				optionen:
					art === 'auswahl' || art === 'termin'
						? (Array.isArray(f?.optionen) ? f.optionen : [])
								.slice(0, MAX_OPTIONEN + 1)
								.map((o: unknown) => text(o, 100))
						: []
			};
		})
	};
	return { wert, fehler: pruefeUmfrage(wert) };
}

/** Inhaltliche Prüfung; undefined, wenn alles passt. */
export function pruefeUmfrage(u: UmfrageEingabe): string | undefined {
	if (u.fragen.length === 0) return 'Die Umfrage braucht mindestens eine Frage.';
	if (u.fragen.length > MAX_FRAGEN) return `Höchstens ${MAX_FRAGEN} Fragen je Umfrage.`;
	for (const [i, f] of u.fragen.entries()) {
		const nr = `Frage ${i + 1}`;
		if (!f.text) return `${nr}: Bitte gib die Frage ein.`;
		if (f.art === 'auswahl' || f.art === 'termin') {
			const was = f.art === 'auswahl' ? 'Antworten' : 'Termine';
			if (f.optionen.some((o) => !o)) return `${nr}: Leere ${was} entfernen oder ausfüllen.`;
			if (f.optionen.length < 2) return `${nr}: Mindestens zwei ${was}.`;
			if (f.optionen.length > MAX_OPTIONEN) return `${nr}: Höchstens ${MAX_OPTIONEN} ${was}.`;
			const klein = f.optionen.map((o) => o.toLocaleLowerCase('de'));
			if (new Set(klein).size !== klein.length) return `${nr}: ${was} doppelt.`;
		}
	}
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(u.ende)) return 'Bitte gib das Ende der Umfrage an.';
	return undefined;
}

export type AntwortWert = number[] | TerminWahl[] | number | string;

export interface FrageDef {
	id: string;
	art: FrageArt;
	pflicht: boolean;
	mehrfach: boolean;
	optionen: string[];
}

/**
 * Antworten aus dem Formular lesen (Felder `q-<id>`, bei Terminen
 * `q-<id>-<n>`). Unbeantwortete freiwillige Fragen fehlen im Ergebnis.
 */
export function leseAntworten(
	fragen: FrageDef[],
	form: { getAll(name: string): unknown[]; get(name: string): unknown }
): { werte: Map<string, AntwortWert>; fehlend: string[] } {
	const werte = new Map<string, AntwortWert>();
	const fehlend: string[] = [];
	for (const f of fragen) {
		let w: AntwortWert | null = null;
		if (f.art === 'auswahl') {
			const idx = [
				...new Set(
					form
						.getAll(`q-${f.id}`)
						.map((v) => Number(v))
						.filter((n) => Number.isInteger(n) && n >= 0 && n < f.optionen.length)
				)
			].sort((a, b) => a - b);
			if (idx.length) w = f.mehrfach ? idx : [idx[0]];
		} else if (f.art === 'termin') {
			const t = f.optionen.map((_, k) => String(form.get(`q-${f.id}-${k}`) ?? ''));
			if (t.every((x) => x === 'ja' || x === 'vielleicht' || x === 'nein')) w = t as TerminWahl[];
		} else if (f.art === 'bewertung') {
			const n = Number(form.get(`q-${f.id}`));
			if (Number.isInteger(n) && n >= 1 && n <= 5) w = n;
		} else {
			const t = String(form.get(`q-${f.id}`) ?? '')
				.trim()
				.slice(0, MAX_FREITEXT);
			if (t) w = t;
		}
		if (w === null) {
			if (f.pflicht) fehlend.push(f.id);
		} else werte.set(f.id, w);
	}
	return { werte, fehlend };
}

/** Darf die Person das Ergebnis (Zahlen) sehen? */
export function ergebnisSichtbar(o: {
	team: boolean;
	ergebnis: Ergebnis;
	ab: ErgebnisAb;
	teilgenommen: boolean;
	beendet: boolean;
}): boolean {
	if (o.team) return true;
	if (o.ergebnis === 'team') return false;
	if (o.ab === 'sofort') return true;
	if (o.ab === 'antwort') return o.teilgenommen || o.beendet;
	return o.beendet;
}

/** Kurzfassung für „Wer sieht was?“ */
/** „das Team von Kantine“ */
export function teamText(einheit: string) {
	return `das Team von ${einheit}`;
}

export function werSiehtWas(o: {
	anonym: boolean;
	ergebnis: Ergebnis;
	ab: ErgebnisAb;
	team: string;
	ende: string;
}): { was: string; wer: string }[] {
	return [
		{
			was: 'Deine Antworten',
			wer: o.anonym
				? `Niemand kann sie dir zuordnen, auch nicht ${o.team} oder die Verwaltung. Gespeichert werden sie ohne deinen Namen.`
				: `${groß(o.team)} sieht deinen Namen bei deinen Antworten. Andere Teilnehmende sehen ihn nicht.`
		},
		{
			was: 'Das Ergebnis (Zahlen)',
			wer:
				o.ergebnis === 'team'
					? `Nur ${o.team}. Du siehst nur deine eigenen Antworten.`
					: o.ab === 'sofort'
						? 'Alle Teilnehmenden, schon vor der eigenen Antwort.'
						: o.ab === 'ende'
							? `Alle Teilnehmenden, aber erst nach dem Ende (${o.ende}).`
							: 'Alle Teilnehmenden, sobald sie selbst geantwortet haben.'
		},
		{
			was: 'Freitext-Antworten',
			wer: `Nur ${o.team}${o.anonym ? ', ohne Namen' : ', mit Namen'}.`
		},
		{
			was: 'Dass du teilgenommen hast',
			wer: o.anonym
				? `Gespeichert, damit du nicht doppelt abstimmst und die Umfrage von deiner Startseite verschwindet. ${groß(o.team)} sieht nur die Anzahl, keine Namen.`
				: `${groß(o.team)} sieht, wer teilgenommen hat.`
		}
	];
}

function groß(t: string) {
	return t.charAt(0).toLocaleUpperCase('de') + t.slice(1);
}
