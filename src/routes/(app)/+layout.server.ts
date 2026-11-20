import { canSeeAdministration } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { unreadCount } from '#lib/server/notify.ts';
import { accentStyle, brandingFor } from '#lib/server/tenant-branding.ts';
import type { LayoutServerLoad } from './$types';

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	const first = parts[0]?.[0] ?? '?';
	const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
	return (first + last).toUpperCase();
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Zähler der Glocke bei jedem Seitenwechsel neu laden
	void url.pathname;
	const principal = requirePrincipal(locals);
	const person = locals.person!;
	const [branding, ungelesen] = await Promise.all([
		brandingFor(person.tenantId),
		unreadCount(person.id)
	]);
	return {
		ich: {
			name: person.displayName,
			kuerzel: initials(person.displayName),
			mandant: branding.name,
			mandantKurz: branding.short
		},
		akzent: accentStyle(branding),
		theme: locals.theme,
		darfVerwaltung: canSeeAdministration(principal),
		ungelesen
	};
};
