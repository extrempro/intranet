/**
 * Erscheinungsbild je Mandant: Akzentfarben, Seitenhintergrund, Logos für
 * hell und dunkel und App-Symbol (Favicon, Startbildschirm). Kurz gepuffert,
 * weil jede Seite (auch das HTML-Grundgerüst) es braucht.
 */
import { eq } from 'drizzle-orm';
import { db } from './db/index.ts';
import { tenants } from './db/schema.ts';
import { normalizeUiFarben, palette, type Palette } from '../color.ts';
import { imageVersions } from './marke.ts';

export interface Branding {
	id: string | null;
	name: string;
	short: string;
	accent: string;
	accentDark: string;
	/** null = Standard der App */
	bg: string | null;
	bgDark: string | null;
	/** Wirksame Oberflächenfarben je Darstellung */
	hell: Palette;
	dunkel: Palette;
	/** Adressen der Logos (mit Stand), null = Kürzel anzeigen */
	logoHell: string | null;
	logoDunkel: string | null;
	/** Basisadresse der App-Symbole, null = Standard-Symbole */
	symbol: string | null;
	symbolStand: number | null;
}

const DEFAULT: Branding = {
	id: null,
	name: 'Intranet',
	short: 'IN',
	accent: '#0F6E56',
	accentDark: '#5DCAA5',
	bg: null,
	bgDark: null,
	hell: palette('hell', '#0F6E56', '#0F6E56'),
	dunkel: palette('dunkel', '#5DCAA5', '#0F6E56'),
	logoHell: null,
	logoDunkel: null,
	symbol: null,
	symbolStand: null
};
const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: string | null) => (v && HEX.test(v) ? v : null);

const columns = {
	id: tenants.id,
	name: tenants.name,
	shortName: tenants.shortName,
	accentColor: tenants.accentColor,
	accentColorDark: tenants.accentColorDark,
	bgColor: tenants.bgColor,
	bgColorDark: tenants.bgColorDark,
	uiColors: tenants.uiColors
};

async function toBranding(row: {
	id: string;
	name: string;
	shortName: string;
	accentColor: string | null;
	accentColorDark: string | null;
	bgColor: string | null;
	bgColorDark: string | null;
	uiColors: unknown;
}): Promise<Branding> {
	const v = await imageVersions(row.id);
	const url = (datei: string, stand?: number) =>
		stand ? `/marke/${row.id}/${datei}?v=${stand}` : null;
	const accent = hex(row.accentColor) ?? DEFAULT.accent;
	const accentDark = hex(row.accentColorDark) ?? DEFAULT.accentDark;
	const ui = normalizeUiFarben(row.uiColors);
	return {
		id: row.id,
		name: row.name,
		short: row.shortName.slice(0, 3).toUpperCase(),
		accent,
		accentDark,
		bg: hex(row.bgColor),
		bgDark: hex(row.bgColorDark),
		hell: palette('hell', accent, accent, {
			...ui.hell,
			hintergrund: hex(row.bgColor) ?? undefined
		}),
		dunkel: palette('dunkel', accentDark, accent, {
			...ui.dunkel,
			hintergrund: hex(row.bgColorDark) ?? undefined
		}),
		logoHell: url('logo-hell.png', v.logo_hell),
		// Ohne eigenes dunkles Logo wird das helle auch im Dunkeln gezeigt
		logoDunkel: url('logo-dunkel.png', v.logo_dunkel) ?? url('logo-hell.png', v.logo_hell),
		symbol: v.symbol_512 ? `/marke/${row.id}` : null,
		symbolStand: v.symbol_512 ?? null
	};
}

const PUFFER_MS = 30_000;
const puffer = new Map<string, { zeit: number; wert: Branding }>();

/** Nach Änderungen in der Verwaltung sofort neu laden. */
export function forgetBranding() {
	puffer.clear();
}

async function gepuffert(key: string, laden: () => Promise<Branding>): Promise<Branding> {
	const hit = puffer.get(key);
	if (hit && Date.now() - hit.zeit < PUFFER_MS) return hit.wert;
	const wert = await laden();
	puffer.set(key, { zeit: Date.now(), wert });
	return wert;
}

export async function brandingFor(tenantId: string): Promise<Branding> {
	return gepuffert(tenantId, async () => {
		const [row] = await db.select(columns).from(tenants).where(eq(tenants.id, tenantId));
		return row ? toBranding(row) : DEFAULT;
	});
}

/** Für Seiten vor der Anmeldung: Branding des Hauptmandanten. */
export async function mainBranding(): Promise<Branding> {
	return gepuffert('haupt', async () => {
		const [row] = await db.select(columns).from(tenants).where(eq(tenants.isMain, true));
		return row ? toBranding(row) : DEFAULT;
	});
}

/**
 * Inline-Stil mit allen Oberflächenfarben je Darstellung (app.css ordnet sie
 * --ac, --fill, --bg, --sf, --bd, --tx und --mu zu). Werte sind geprüfte Hex-Farben.
 */
export function accentStyle(b: Branding): string {
	const vars = (m: 'hell' | 'dunkel', p: Palette) => [
		`--ac-${m}: ${p.akzent}`,
		`--fill-${m}: ${p.knopf}`,
		`--bg-${m}: ${p.hintergrund}`,
		`--sf-${m}: ${p.flaeche}`,
		`--bd-${m}: ${p.rahmen}`,
		`--tx-${m}: ${p.text}`,
		`--mu-${m}: ${p.grau}`
	];
	return [...vars('hell', b.hell), ...vars('dunkel', b.dunkel)].join('; ') + ';';
}

/** Favicon, Manifest und Symbol für den Kopf des HTML-Dokuments. */
export function headLinks(b: Branding): string {
	const theme = `<meta name="theme-color" content="${b.accent}" />`;
	if (!b.symbol) {
		return [
			'<link rel="icon" href="/favicon.svg" />',
			'<link rel="manifest" href="/manifest.webmanifest" />',
			'<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
			theme
		].join('\n\t\t');
	}
	const v = b.symbolStand ?? 0;
	return [
		`<link rel="icon" type="image/png" sizes="32x32" href="${b.symbol}/symbol-32.png?v=${v}" />`,
		`<link rel="manifest" href="${b.symbol}/manifest.webmanifest?v=${v}" />`,
		`<link rel="apple-touch-icon" href="${b.symbol}/symbol-180.png?v=${v}" />`,
		theme
	].join('\n\t\t');
}
