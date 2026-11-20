import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { mailConfigured } from '#lib/server/mail.ts';
import { pushStatus, sendToPerson, vapidKeys } from '#lib/server/push.ts';
import type { Actions, PageServerLoad } from './$types';

/** Benachrichtigungen (Kap. 14): Zustand von Web Push und E-Mail, Testnachricht. */
export const load: PageServerLoad = async ({ locals }) => {
	const p = requirePrincipal(locals);
	await vapidKeys();
	return {
		push: await pushStatus(),
		mail: await mailConfigured(),
		system: isSystemAdmin(p)
	};
};

export const actions: Actions = {
	test: async ({ locals }) => {
		const p = requirePrincipal(locals);
		const n = await sendToPerson(p.personId, {
			title: 'Testnachricht aus dem Intranet',
			body: 'Wenn du das liest, kommen Push-Nachrichten an.',
			link: '/verwaltung/benachrichtigungen',
			tag: 'test'
		});
		return {
			ergebnis:
				n > 0
					? `Testnachricht an ${n} ${n === 1 ? 'Gerät' : 'Geräte'} gesendet.`
					: 'Kein Gerät erreicht. Schalte Push unter Konto → Benachrichtigungen auf diesem Gerät ein.'
		};
	}
};
