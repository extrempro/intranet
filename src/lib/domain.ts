/** E-Mail-Domains der Mandanten (Kap. 3.1). */
const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Vereinheitlicht und prüft eine Domain; null, wenn ungültig. */
export function normalizeDomain(input: string): string | null {
	const d = input.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, '');
	return DOMAIN.test(d) ? d : null;
}

/** Liste aus Komma, Semikolon, Leerzeichen oder Zeilen; Ungültiges getrennt zurück. */
export function parseDomainList(input: string): { domains: string[]; invalid: string[] } {
	const parts = input.split(/[\s,;]+/).filter(Boolean);
	const domains: string[] = [];
	const invalid: string[] = [];
	for (const p of parts) {
		const d = normalizeDomain(p);
		if (!d) invalid.push(p);
		else if (!domains.includes(d)) domains.push(d);
	}
	return { domains, invalid };
}
