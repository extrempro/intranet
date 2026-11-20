import { eq } from 'drizzle-orm';
import { db } from './db/index.ts';
import { tenants } from './db/schema.ts';

export interface Branding {
	name: string;
	short: string;
	accent: string;
	accentDark: string;
}

const DEFAULT: Branding = {
	name: 'Intranet',
	short: 'IN',
	accent: '#0F6E56',
	accentDark: '#5DCAA5'
};
const HEX = /^#[0-9a-fA-F]{6}$/;

function toBranding(row: {
	name: string;
	shortName: string;
	accentColor: string | null;
	accentColorDark: string | null;
}): Branding {
	return {
		name: row.name,
		short: row.shortName.slice(0, 3).toUpperCase(),
		accent: row.accentColor && HEX.test(row.accentColor) ? row.accentColor : DEFAULT.accent,
		accentDark:
			row.accentColorDark && HEX.test(row.accentColorDark)
				? row.accentColorDark
				: DEFAULT.accentDark
	};
}

const columns = {
	name: tenants.name,
	shortName: tenants.shortName,
	accentColor: tenants.accentColor,
	accentColorDark: tenants.accentColorDark
};

export async function brandingFor(tenantId: string): Promise<Branding> {
	const [row] = await db.select(columns).from(tenants).where(eq(tenants.id, tenantId));
	return row ? toBranding(row) : DEFAULT;
}

/** Für Seiten vor der Anmeldung: Branding des Hauptmandanten. */
export async function mainBranding(): Promise<Branding> {
	const [row] = await db.select(columns).from(tenants).where(eq(tenants.isMain, true));
	return row ? toBranding(row) : DEFAULT;
}

/** Inline-Stil mit den Akzentfarben; Werte sind oben auf Hex geprüft. */
export function accentStyle(b: Branding): string {
	return `--ac-hell: ${b.accent}; --ac-dunkel: ${b.accentDark}; --fill: ${b.accent};`;
}
