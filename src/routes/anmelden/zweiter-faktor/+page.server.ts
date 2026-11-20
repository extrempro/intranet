import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { completeLocalLogin } from '#lib/server/auth/complete.ts';
import {
	getPending,
	secondFactorWait,
	useRecoveryCode,
	verifyTotpForPerson
} from '#lib/server/auth/local.ts';
import { hasPasskeys } from '#lib/server/auth/passkey.ts';
import { audit } from '#lib/server/audit.ts';
import { db } from '#lib/server/db/index.ts';
import { localCredentials } from '#lib/server/db/schema.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const pending = await getPending(cookies, 'mfa');
	if (!pending) redirect(303, '/anmelden');
	const [cred] = await db
		.select({ totp: localCredentials.totpConfirmedAt })
		.from(localCredentials)
		.where(eq(localCredentials.personId, pending.personId));
	return { hatTotp: Boolean(cred?.totp), hatPasskey: await hasPasskeys(pending.personId) };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const pending = await getPending(cookies, 'mfa');
		if (!pending) redirect(303, '/anmelden');
		const ip = getClientAddress();

		const wait = await secondFactorWait(pending.personId);
		if (wait > 0) {
			return fail(429, {
				art: null,
				fehler: `Zu viele Fehlversuche. Warte bitte ${wait} Sekunden und versuch es dann noch einmal.`
			});
		}

		const form = await request.formData();
		const art = form.get('art') === 'wiederherstellung' ? 'recovery' : 'totp';
		const code = String(form.get('code') ?? '').slice(0, 40);
		const ok =
			art === 'recovery'
				? await useRecoveryCode(pending.personId, code)
				: await verifyTotpForPerson(pending.personId, code);

		if (!ok) {
			await audit({
				category: 'security',
				action: 'login.local.second_factor_failed',
				actorId: pending.personId,
				details: { art },
				ip
			});
			return fail(400, {
				art,
				fehler:
					art === 'recovery'
						? 'Dieser Wiederherstellungscode passt nicht oder wurde schon benutzt.'
						: 'Der Code passt nicht. Nimm bitte den aktuellen Code aus deiner App.'
			});
		}

		const ziel = await completeLocalLogin(cookies, pending, {
			userAgent: request.headers.get('user-agent'),
			ip,
			method: art
		});
		redirect(303, ziel);
	}
};
