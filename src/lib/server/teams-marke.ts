/**
 * Aussehen der Teams-App (Verwaltung → Benachrichtigungen → Teams): Name,
 * Beschreibung, Herausgeber, Farbe und Symbole. Ohne eigene Angaben gilt das
 * Branding des Hauptmandanten (App-Symbol, Akzentfarbe). Es gibt nur eine
 * Teams-App für alle Häuser.
 */
import { pngSize, readImage } from './marke.ts';
import { pageIcon } from './png.ts';
import { getSetting, setSetting } from './settings.ts';
import { mainBranding } from './tenant-branding.ts';

export interface TeamsMarke {
	kurzname: string;
	langname: string;
	kurzbeschreibung: string;
	langbeschreibung: string;
	herausgeber: string;
	/** Akzentfarbe hinter dem Symbol, „#RRGGBB“; leer = vom Hauptmandanten */
	farbe: string;
}

export const TEAMS_MARKE_STANDARD: TeamsMarke = {
	kurzname: 'Intranet',
	langname: 'Intranet',
	kurzbeschreibung: 'Das Intranet in Teams',
	langbeschreibung:
		'Das Intranet direkt in Teams, mit Anmeldung über dein Microsoft-Konto. Benachrichtigungen erscheinen unter „Aktivität“; ein Klick öffnet den Beitrag in der App.',
	herausgeber: 'IT',
	farbe: ''
};

/** Höchstlängen nach dem Teams-App-Manifest */
export const TEAMS_MARKE_MAX = {
	kurzname: 30,
	langname: 100,
	kurzbeschreibung: 80,
	langbeschreibung: 4000,
	herausgeber: 32
} as const;

export class TeamsMarkeError extends Error {}

const HEX = /^#[0-9a-f]{6}$/i;

export async function getTeamsMarke(): Promise<TeamsMarke> {
	const s = await getSetting<Partial<TeamsMarke> | null>('teams.marke', null);
	return { ...TEAMS_MARKE_STANDARD, ...(s ?? {}) };
}

/** Prüfen und speichern; leere Felder fallen auf den Standard zurück. */
export async function saveTeamsMarke(input: Partial<TeamsMarke>, by: string): Promise<TeamsMarke> {
	const m = { ...TEAMS_MARKE_STANDARD };
	for (const k of Object.keys(TEAMS_MARKE_MAX) as (keyof typeof TEAMS_MARKE_MAX)[]) {
		const v = (input[k] ?? '').trim();
		if (v.length > TEAMS_MARKE_MAX[k])
			throw new TeamsMarkeError(`Höchstens ${TEAMS_MARKE_MAX[k]} Zeichen (${k}).`);
		if (v) m[k] = v;
	}
	const farbe = (input.farbe ?? '').trim();
	if (farbe && !HEX.test(farbe))
		throw new TeamsMarkeError('Die Farbe bitte als #RRGGBB angeben, z. B. #0F6E56.');
	m.farbe = farbe.toUpperCase();
	await setSetting('teams.marke', m, by);
	return m;
}

// ---------------------------------------------------------------------------
// Symbole: farbig 192 × 192, Umriss 32 × 32 (weiß auf durchsichtig)
// ---------------------------------------------------------------------------

interface GespeicherteSymbole {
	farbig: string | null;
	umriss: string | null;
}

const MAX_SYMBOL = 300_000;

function pruefe(b: Uint8Array, n: number, was: string) {
	if (b.length === 0 || b.length > MAX_SYMBOL)
		throw new TeamsMarkeError(`${was}: Datei fehlt oder ist zu groß.`);
	const s = pngSize(b);
	if (!s || s.width !== n || s.height !== n)
		throw new TeamsMarkeError(`${was}: Bitte ein PNG mit ${n} × ${n} Pixeln.`);
}

export async function saveTeamsSymbole(farbig: Uint8Array, umriss: Uint8Array | null, by: string) {
	pruefe(farbig, 192, 'Farbiges Symbol');
	if (umriss) pruefe(umriss, 32, 'Umriss-Symbol');
	const wert: GespeicherteSymbole = {
		farbig: Buffer.from(farbig).toString('base64'),
		umriss: umriss ? Buffer.from(umriss).toString('base64') : null
	};
	await setSetting('teams.symbole', wert, by);
}

export async function deleteTeamsSymbole(by: string) {
	const leer: GespeicherteSymbole = { farbig: null, umriss: null };
	await setSetting('teams.symbole', leer, by);
}

const WEISS: [number, number, number, number] = [255, 255, 255, 255];
const LEER: [number, number, number, number] = [0, 0, 0, 0];

function hexRgba(hex: string): [number, number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/**
 * Was ins App-Paket kommt: eigene Symbole, sonst das App-Symbol des
 * Hauptmandanten, sonst ein einfaches Seiten-Symbol in der Akzentfarbe.
 */
export async function teamsAppAussehen() {
	const [marke, eigene, haupt] = await Promise.all([
		getTeamsMarke(),
		getSetting<GespeicherteSymbole | null>('teams.symbole', null),
		mainBranding()
	]);
	const farbe = marke.farbe || haupt.accent.toUpperCase();
	let farbig: Uint8Array | null = eigene?.farbig ? Buffer.from(eigene.farbig, 'base64') : null;
	let quelle: 'eigen' | 'mandant' | 'standard' = farbig ? 'eigen' : 'standard';
	if (!farbig && haupt.id && haupt.symbolStand) {
		const bild = await readImage(haupt.id, 'symbol_192');
		if (bild) {
			farbig = new Uint8Array(bild.data);
			quelle = 'mandant';
		}
	}
	return {
		marke: { ...marke, farbe },
		farbig: farbig ?? pageIcon(192, WEISS, hexRgba(farbe)),
		umriss: eigene?.umriss ? Buffer.from(eigene.umriss, 'base64') : pageIcon(32, WEISS, LEER),
		quelle,
		eigenerUmriss: Boolean(eigene?.umriss),
		datenschutz: haupt.datenschutz,
		impressum: haupt.impressum
	};
}
