import { initials } from '#lib/format.ts';
import { canSeeAdministration } from '#lib/server/auth/access.ts';
import { photosOf } from '#lib/server/people.ts';
import { getHelpSeen } from '#lib/server/preferences.ts';
import { takeFlash } from '#lib/server/flash.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { unreadConversations } from '#lib/server/messages.ts';
import { unreadCount } from '#lib/server/notify.ts';
import { accentStyle, brandingFor } from '#lib/server/tenant-branding.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	// Zähler der Glocke bei jedem Seitenwechsel neu laden
	void url.pathname;
	const principal = requirePrincipal(locals);
	const person = locals.person!;
	const [branding, ungelesen, nachrichten, fotos, hilfeGesehen] = await Promise.all([
		brandingFor(person.tenantId),
		unreadCount(person.id),
		unreadConversations(principal),
		photosOf([person.id]),
		getHelpSeen(person.id)
	]);
	return {
		ich: {
			name: person.displayName,
			kuerzel: initials(person.displayName),
			foto: fotos.get(person.id) ?? null,
			mandant: branding.name,
			mandantKurz: branding.short
		},
		akzent: accentStyle(branding),
		theme: locals.theme,
		darfVerwaltung: canSeeAdministration(principal),
		// Redaktion: ganze Arbeitsliste; Moderation: nur Abschnitt Schwarzes Brett (Kap. 10)
		darfRedaktion: principal.roles.some(
			(r) => r.role === 'redaktion' || r.role === 'moderation_schwarzes_brett'
		),
		ungelesen,
		nachrichten,
		meldung: takeFlash(cookies),
		hilfeGesehen
	};
};
