import { fail, redirect } from '@sveltejs/kit';
import { encodeBase32UpperCaseNoPadding } from '@oslojs/encoding';
import { renderSVG } from 'uqr';
import { completeLocalLogin } from '#lib/server/auth/complete.ts';
import {
	confirmTotpSetup,
	encryptTotpKey,
	getPending,
	personBasics,
	replaceRecoveryCodes,
	updatePending
} from '#lib/server/auth/local.ts';
import { formatKeyForDisplay, generateTotpKey, totpUri } from '#lib/server/auth/totp.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const pending = await getPending(cookies, 'setup');
	if (!pending) redirect(303, '/anmelden');
	const person = await personBasics(pending.personId);
	return { name: person?.displayName ?? '', fertig: pending.setupDone };
};

export const actions: Actions = {
	totpStarten: async ({ cookies }) => {
		const pending = await getPending(cookies, 'setup');
		if (!pending) redirect(303, '/anmelden');
		const person = await personBasics(pending.personId);
		if (!person) redirect(303, '/anmelden');

		const key = generateTotpKey();
		await updatePending(pending.id, { pendingTotpEnc: encryptTotpKey(key) });
		const uri = totpUri(key, person.email);
		return {
			totp: {
				// SVG wird hier erzeugt, enthält keine Eingaben von außen außer der eigenen E-Mail
				qr: renderSVG(uri, { border: 2 }),
				schluessel: formatKeyForDisplay(encodeBase32UpperCaseNoPadding(key))
			}
		};
	},

	totpBestaetigen: async ({ request, cookies }) => {
		const pending = await getPending(cookies, 'setup');
		if (!pending) redirect(303, '/anmelden');
		const code = String((await request.formData()).get('code') ?? '').slice(0, 10);
		if (!(await confirmTotpSetup(pending, code))) {
			return fail(400, {
				totpFehler: 'Der Code passt nicht. Prüf bitte, ob die Uhrzeit auf deinem Handy stimmt.',
				totpOffen: true
			});
		}
		const codes = await replaceRecoveryCodes(pending.personId);
		await updatePending(pending.id, { setupDone: true });
		return { codes };
	},

	fertig: async ({ request, cookies, getClientAddress }) => {
		const pending = await getPending(cookies, 'setup');
		if (!pending) redirect(303, '/anmelden');
		if (!pending.setupDone)
			return fail(400, { fehler: 'Richte bitte zuerst einen zweiten Faktor ein.' });
		const ziel = await completeLocalLogin(cookies, pending, {
			userAgent: request.headers.get('user-agent'),
			ip: getClientAddress(),
			method: 'setup'
		});
		redirect(303, ziel);
	}
};
