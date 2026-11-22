import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { boxesFor, listConversations } from '#lib/server/messages.ts';
import { anzahlAus } from '#lib/lange-liste.ts';
import type { PageServerLoad } from './$types';

/** Gespräche je Schritt „ältere laden“ (Kap. 6.7) */
const SCHRITT = 30;

export const load: PageServerLoad = async ({ locals, url }) => {
	const p = requirePrincipal(locals);
	const boxes = await boxesFor(p);
	const box = boxes.find((b) => b.key === url.searchParams.get('postfach')) ?? boxes[0];
	const erledigt = url.searchParams.get('status') === 'erledigt';
	const anzahl = anzahlAus(url, SCHRITT, 5000);
	const i = boxes.indexOf(box);
	// Zähler an den Reitern: offene Gespräche je Postfach (Gesamtzahl aus der
	// ersten Zeile), erledigte im gewählten; geladen wird nur die gewählte Liste
	const [offen, erledigte] = await Promise.all([
		Promise.all(
			boxes.map((b, n) => listConversations(p, b, false, n === i && !erledigt ? anzahl : 1))
		),
		listConversations(p, box, true, erledigt ? anzahl : 1)
	]);
	const zahl = (l: { gesamt: number }[]) => l[0]?.gesamt ?? 0;
	return {
		boxes: boxes.map(({ key, label }, n) => ({ key, label, offen: zahl(offen[n]) })),
		box: box.key,
		rolle: box.tenantId !== null,
		erledigt,
		anzahl: { offen: zahl(offen[i]), erledigt: zahl(erledigte) },
		liste: erledigt ? erledigte : offen[i],
		gesamt: erledigt ? zahl(erledigte) : zahl(offen[i]),
		geladenBis: anzahl,
		schritt: SCHRITT
	};
};
