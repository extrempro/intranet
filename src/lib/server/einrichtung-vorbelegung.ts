import { parseDomainList } from '../domain.ts';
import { HEX } from '../color.ts';

export interface InitialTenant {
	name: string;
	shortName: string;
	domains: string[];
	accent: string | null;
	accentDark: string | null;
}

/**
 * Vorbelegung des Einrichtungsformulars (Hauptmandant) aus INITIAL_TENANT_*,
 * siehe einrichtung.ts. null, wenn nichts gesetzt ist; wirft bei
 * unvollständigen oder ungültigen Angaben (dann bleibt das Formular leer).
 */
export function readInitialTenant(env: Record<string, string | undefined>): InitialTenant | null {
	const name = env.INITIAL_TENANT_NAME?.trim();
	const shortName = env.INITIAL_TENANT_SHORT?.trim();
	const rawDomains = env.INITIAL_TENANT_DOMAINS?.trim();
	if (!name && !shortName && !rawDomains) return null;
	if (!name || !shortName || !rawDomains) {
		throw new Error(
			'INITIAL_TENANT_NAME, INITIAL_TENANT_SHORT und INITIAL_TENANT_DOMAINS müssen zusammen gesetzt sein'
		);
	}
	if (shortName.length > 10)
		throw new Error('INITIAL_TENANT_SHORT darf höchstens 10 Zeichen haben');
	const { domains, invalid } = parseDomainList(rawDomains);
	if (invalid.length || domains.length === 0) {
		throw new Error(
			`INITIAL_TENANT_DOMAINS enthält ungültige Domains: ${invalid.join(', ') || '(leer)'}`
		);
	}
	const color = (v: string | undefined, key: string) => {
		const c = v?.trim();
		if (!c) return null;
		if (!HEX.test(c)) throw new Error(`${key} muss eine Farbe wie #0F6E56 sein`);
		return c;
	};
	return {
		name,
		shortName,
		domains,
		accent: color(env.INITIAL_TENANT_ACCENT, 'INITIAL_TENANT_ACCENT'),
		accentDark: color(env.INITIAL_TENANT_ACCENT_DARK, 'INITIAL_TENANT_ACCENT_DARK')
	};
}
