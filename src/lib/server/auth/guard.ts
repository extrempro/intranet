import { error } from '@sveltejs/kit';
import type { Principal } from './access.ts';

/** Angemeldete Person mit Principal oder 401. */
export function requirePrincipal(locals: App.Locals): Principal {
	if (!locals.principal || !locals.person) error(401, 'Bitte melde dich an.');
	return locals.principal;
}

/** Bricht mit 403 ab, wenn die Bedingung nicht erfüllt ist. */
export function requireThat(allowed: boolean): void {
	if (!allowed) error(403, 'Dafür fehlt dir das Recht.');
}
