import { redirect } from '@sveltejs/kit';
import { DENIED_MESSAGES } from '#lib/server/auth/entra-login.ts';
import { getEntraConfig, safeReturnTo } from '#lib/server/auth/entra.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const ziel = safeReturnTo(url.searchParams.get('ziel'));
	if (locals.person) redirect(303, ziel);

	const code = url.searchParams.get('fehler');
	const fehler =
		code && Object.hasOwn(DENIED_MESSAGES, code)
			? DENIED_MESSAGES[code as keyof typeof DENIED_MESSAGES]
			: code
				? DENIED_MESSAGES.failed
				: null;

	return {
		ziel,
		fehler,
		abgemeldet: url.searchParams.has('abgemeldet'),
		entraAktiv: (await getEntraConfig()) !== null
	};
};
