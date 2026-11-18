/**
 * Ordnet eine E-Mail-Adresse anhand ihrer Domain einem Mandanten zu
 * (docs/spec.md, Kap. 3.1). Gibt null zurück, wenn keine Domain passt.
 *
 * @param email   E-Mail-Adresse der Person
 * @param domains Zuordnung Domain → Mandanten-ID, Domains in Kleinbuchstaben
 */
export function tenantFromEmail(email: string, domains: Record<string, string>): string | null {
	const at = email.trim().lastIndexOf('@');
	if (at < 1 || at === email.trim().length - 1) return null;
	const domain = email.trim().slice(at + 1).toLowerCase();
	return Object.hasOwn(domains, domain) ? domains[domain] : null;
}
