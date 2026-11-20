/**
 * Offline gespeicherte Pläne (Kap. 8.6), nur im Browser. Die PDFs liegen im
 * Cache „intranet-plaene“ unter ihrer Adresse /dateien/<id>, die Liste dazu
 * unter /__offline/plaene.json. Beim Abmelden löscht der Server beides.
 */
export const OFFLINE_CACHE = 'intranet-plaene';
const LISTE = '/__offline/plaene.json';

export interface OfflinePlan {
	id: string;
	fileId: string;
	title: string;
	kbb: string;
	validUntil: string;
	savedAt: string;
}

export function offlineMoeglich(): boolean {
	return typeof caches !== 'undefined';
}

export async function offlinePlaene(): Promise<OfflinePlan[]> {
	if (!offlineMoeglich()) return [];
	const res = await (await caches.open(OFFLINE_CACHE)).match(LISTE);
	if (!res) return [];
	try {
		const list = await res.json();
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

async function speichereListe(list: OfflinePlan[]) {
	const cache = await caches.open(OFFLINE_CACHE);
	await cache.put(
		LISTE,
		new Response(JSON.stringify(list), { headers: { 'content-type': 'application/json' } })
	);
}

/** Plan offline speichern (ersetzt eine ältere Fassung desselben Plans). */
export async function planOfflineSpeichern(plan: Omit<OfflinePlan, 'savedAt'>) {
	const cache = await caches.open(OFFLINE_CACHE);
	const url = `/dateien/${plan.fileId}`;
	const res = await fetch(url, { credentials: 'same-origin' });
	if (!res.ok) throw new Error('Plan nicht abrufbar');
	await cache.put(url, res);
	const list = await offlinePlaene();
	const alt = list.find((p) => p.id === plan.id);
	if (alt && alt.fileId !== plan.fileId) await cache.delete(`/dateien/${alt.fileId}`);
	await speichereListe([
		...list.filter((p) => p.id !== plan.id),
		{ ...plan, savedAt: new Date().toISOString() }
	]);
}

export async function planOfflineEntfernen(id: string) {
	const cache = await caches.open(OFFLINE_CACHE);
	const list = await offlinePlaene();
	const alt = list.find((p) => p.id === id);
	if (alt) await cache.delete(`/dateien/${alt.fileId}`);
	await speichereListe(list.filter((p) => p.id !== id));
}

export interface PlanAenderung {
	plan: OfflinePlan;
	/** Neue Datei-ID; null = Plan gibt es nicht mehr */
	neu: { fileId: string; title: string; validUntil: string } | null;
}

/** Nach dem Wiederverbinden: Welche offline gespeicherten Pläne haben sich geändert? */
export async function geaenderteOfflinePlaene(): Promise<PlanAenderung[]> {
	const list = await offlinePlaene();
	if (!list.length) return [];
	const res = await fetch(`/plaene/stand?ids=${list.map((p) => p.id).join(',')}`, {
		credentials: 'same-origin'
	});
	if (!res.ok) return [];
	const stand: Record<string, { fileId: string; title: string; validUntil: string } | null> =
		await res.json();
	return list
		.filter((p) => p.id in stand && stand[p.id]?.fileId !== p.fileId)
		.map((p) => ({ plan: p, neu: stand[p.id] }));
}
