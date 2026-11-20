/**
 * Daten der Konto-Seite (eine Seite wie im Entwurf); die Unterseiten unter
 * /konto/* nutzen dieselben Funktionen und behalten ihre Aktionen.
 */
import { eq } from 'drizzle-orm';
import { TOPICS, type TopicDefinition } from '#lib/notify.ts';
import { canSeeAdministration, isSystemAdmin, type Principal } from './auth/access.ts';
import { allLocations, myLocationIds } from './canteen.ts';
import { db } from './db/index.ts';
import { persons } from './db/schema.ts';
import { mailConfigured } from './mail.ts';
import { getNotify } from './notify.ts';
import { listDevices, vapidKeys } from './push.ts';
import { teamsActive } from './teams-config.ts';

/** Teams-Spalte nur mit Microsoft-Konto und eingeschalteten Teams-Benachrichtigungen */
export async function teamsFor(p: Principal): Promise<boolean> {
	if (!(await teamsActive())) return false;
	const [row] = await db
		.select({ oid: persons.entraOid })
		.from(persons)
		.where(eq(persons.id, p.personId));
	return Boolean(row?.oid);
}

/** Themen nur für bestimmte Aufgaben (Moderation, Pflege einer Einheit) */
export function topicAllowed(p: Principal, onlyFor: TopicDefinition['onlyFor']) {
	if (!onlyFor) return true;
	if (onlyFor === 'system') return isSystemAdmin(p);
	if (onlyFor === 'moderation') return p.roles.some((r) => r.role === 'moderation_schwarzes_brett');
	if (onlyFor === 'verwaltung') return canSeeAdministration(p);
	return p.roles.some((r) => r.role === 'abteilungsverwaltung' || r.role === 'redaktion');
}

export async function benachrichtigungsDaten(p: Principal) {
	const [einstellung, mailBereit, geraete, keys, teams] = await Promise.all([
		getNotify(p.personId),
		mailConfigured(),
		listDevices(p),
		vapidKeys(),
		teamsFor(p)
	]);
	return {
		einstellung,
		mailBereit,
		geraete: geraete.map((g) => ({
			id: g.id,
			label: g.label,
			endpoint: g.endpoint,
			createdAt: g.createdAt,
			lastSuccessAt: g.lastSuccessAt
		})),
		vapidKey: keys.publicKey,
		teams,
		themen: TOPICS.filter((t) => !t.hidden)
			.filter((t) => topicAllowed(p, t.onlyFor))
			.map((t) => t.key)
	};
}

export async function standortDaten(p: Principal) {
	const [alle, meine] = await Promise.all([allLocations(), myLocationIds(p.personId)]);
	return { alle, meine };
}
