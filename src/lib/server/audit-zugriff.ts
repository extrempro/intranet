/**
 * Verweigerte Zugriffe (403) ins Protokoll (ASVS 5.0 V16.3.2). Dieselbe Person
 * und derselbe Pfad höchstens einmal in 10 Minuten, damit Wiederholungen das
 * Protokoll nicht fluten. Nur Pfad und Methode, keine Inhalte oder Parameter.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { audit } from './audit.ts';

const FENSTER_MS = 10 * 60_000;
const zuletzt = new Map<string, number>();

/** Pfad ohne IDs gruppieren, damit das Durchprobieren vieler IDs auffällt, aber nicht flutet */
export function pfadMuster(pfad: string): string {
	return pfad
		.slice(0, 200)
		.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}

export function sollProtokollieren(schluessel: string, jetzt = Date.now()): boolean {
	const vorher = zuletzt.get(schluessel);
	if (vorher && jetzt - vorher < FENSTER_MS) return false;
	if (zuletzt.size > 5000) zuletzt.clear();
	zuletzt.set(schluessel, jetzt);
	return true;
}

export async function zugriffVerweigert(event: RequestEvent) {
	const p = event.locals.person;
	if (!p) return;
	const pfad = event.url.pathname.slice(0, 200);
	const aktion = [...event.url.searchParams.keys()].find((k) => k.startsWith('/'))?.slice(1, 40);
	if (!sollProtokollieren(`${p.id}|${pfadMuster(pfad)}|${aktion ?? ''}`)) return;
	let ip: string | undefined;
	try {
		ip = event.getClientAddress();
	} catch {
		ip = undefined;
	}
	await audit({
		category: 'security',
		action: 'access.denied',
		actorId: p.id,
		tenantId: p.tenantId,
		details: { pfad, methode: event.request.method, ...(aktion ? { aktion } : {}) },
		ip
	});
}
