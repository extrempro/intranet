/**
 * Startseite (Kap. 7): Karten und Favoriten, auf Server und im Browser nutzbar.
 * Karten kommen hinzu, sobald ihre Funktion fertig ist.
 */
export interface HomeLayout {
	order: string[];
	hidden: string[];
}

export interface CardDefinition {
	id: string;
	label: string;
}

/** Bekannte Karten in Standardreihenfolge. */
export const HOME_CARDS: CardDefinition[] = [
	{ id: 'neuigkeiten', label: 'Neuigkeiten' },
	{ id: 'termine', label: 'Heute und morgen' },
	{ id: 'hubs', label: 'Neu in deinen Hubs' },
	{ id: 'speiseplan', label: 'Speiseplan' },
	{ id: 'plaene', label: 'Aktuelle Pläne' },
	{ id: 'umfragen', label: 'Offene Umfragen' }
];

export const FAVORITES_MAX = 8;

/**
 * Setzt die Kartenreihenfolge aus persönlicher Einstellung, Mandanten-Standard
 * und bekannten Karten zusammen. Unbekannte Karten fallen weg, neue Karten
 * erscheinen sichtbar am Ende.
 */
export function resolveLayout(
	cards: readonly CardDefinition[],
	personal: HomeLayout | null | undefined,
	tenantDefault: HomeLayout | null | undefined
): { id: string; label: string; visible: boolean }[] {
	const base = personal ?? tenantDefault ?? { order: [], hidden: [] };
	const known = new Map(cards.map((c) => [c.id, c]));
	const ordered = base.order.filter((id, i) => known.has(id) && base.order.indexOf(id) === i);
	for (const c of cards) if (!ordered.includes(c.id)) ordered.push(c.id);
	const hidden = new Set(base.hidden);
	return ordered.map((id) => ({ id, label: known.get(id)!.label, visible: !hidden.has(id) }));
}

/** Verschiebt ein Element um delta Plätze (−1 hoch, +1 runter); außerhalb bleibt alles gleich. */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
	const target = index + delta;
	if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
	const copy = [...list];
	[copy[index], copy[target]] = [copy[target], copy[index]];
	return copy;
}

/** Begrüßung nach Tageszeit. */
/**
 * Stunde (0–23) in Berlin. Über formatToParts, weil `format` je nach
 * Laufzeit „08 Uhr“ liefert und Number() daraus NaN macht.
 */
export function berlinHour(now: Date): number {
	const h = new Intl.DateTimeFormat('de-DE', {
		hour: 'numeric',
		hourCycle: 'h23',
		timeZone: 'Europe/Berlin'
	})
		.formatToParts(now)
		.find((p) => p.type === 'hour')?.value;
	return Number(h ?? 12);
}

export function greeting(hour: number): string {
	if (hour < 11) return 'Guten Morgen';
	if (hour < 18) return 'Hallo';
	return 'Guten Abend';
}
