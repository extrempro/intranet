import { initials } from '#lib/format.ts';
import { canSeeAdministration, type Principal } from '#lib/server/auth/access.ts';
import { photosOf } from '#lib/server/people.ts';
import { getHelpSeen, getNewsSeen, markNewsSeen } from '#lib/server/preferences.ts';
import { countNewNews } from '#lib/server/news.ts';
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
	const [branding, ungelesen, nachrichten, fotos, hilfeGesehen, neueBeitraege] = await Promise.all([
		brandingFor(person.tenantId),
		unreadCount(person.id),
		unreadConversations(principal),
		photosOf([person.id]),
		getHelpSeen(person.id),
		neueNeuigkeiten(principal, url.pathname)
	]);
	return {
		ich: {
			name: person.displayName,
			kuerzel: initials(person.displayName),
			foto: fotos.get(person.id) ?? null,
			mandant: branding.name,
			mandantKurz: branding.short
		},
		logo: { hell: branding.logoHell, dunkel: branding.logoDunkel },
		rechtliches: { datenschutz: branding.datenschutz, impressum: branding.impressum },
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
		hilfeGesehen,
		neueBeitraege
	};
};

/**
 * Zähler „neue Beiträge“ an Aktuelles/Neuigkeiten. Wer die Neuigkeiten
 * öffnet, hat sie gesehen; beim allerersten Besuch beginnt die Zählung jetzt.
 */
async function neueNeuigkeiten(principal: Principal, pfad: string): Promise<number> {
	if (pfad === '/neuigkeiten') {
		await markNewsSeen(principal.personId);
		return 0;
	}
	const seit = await getNewsSeen(principal.personId);
	if (!seit) {
		await markNewsSeen(principal.personId);
		return 0;
	}
	return countNewNews(principal, seit);
}
