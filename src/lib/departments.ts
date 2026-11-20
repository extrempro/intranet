/**
 * Abteilungsseiten (Kap. 8.11): reine Hilfen für „Wer hilft bei was?“ –
 * Eingaben prüfen, Links lesen, Suche und Prüf-Erinnerung.
 */

export interface ResponsibilityInput {
	topic: string;
	description: string;
	keywords: string;
	groupName: string;
	personId: string;
	deputyId: string;
	links: string;
}

export interface CleanResponsibility {
	topic: string;
	description: string | null;
	keywords: string[];
	groupName: string | null;
	personId: string | null;
	deputyId: string | null;
	links: { label: string; url: string }[];
}

export type ResponsibilityErrors = Partial<Record<keyof ResponsibilityInput, string>>;

export const RESPONSIBILITY_LIMITS = {
	topic: 120,
	description: 500,
	keywords: 10,
	keyword: 40,
	group: 60,
	links: 5,
	linkLabel: 80,
	url: 500
};

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stichwörter durch Komma oder Zeilenumbruch getrennt, ohne Doppelte. */
export function parseKeywords(raw: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const part of raw.split(/[,\n;]/)) {
		const k = part.trim().replace(/\s+/g, ' ');
		if (!k || seen.has(k.toLowerCase())) continue;
		seen.add(k.toLowerCase());
		out.push(k);
	}
	return out;
}

/**
 * Links, je Zeile „Bezeichnung | Adresse“ oder nur die Adresse.
 * Erlaubt sind https://, http:// und Pfade im Intranet (/...), sonst nichts.
 */
export function parseLinks(raw: string): {
	links: { label: string; url: string }[];
	error?: string;
} {
	const links: { label: string; url: string }[] = [];
	for (const line of raw.split('\n')) {
		const l = line.trim();
		if (!l) continue;
		const bar = l.lastIndexOf('|');
		const label = (bar >= 0 ? l.slice(0, bar) : '').trim();
		const url = (bar >= 0 ? l.slice(bar + 1) : l).trim();
		if (!isSafeUrl(url))
			return { links, error: `„${url.slice(0, 60)}“ ist keine gültige Adresse.` };
		if (url.length > RESPONSIBILITY_LIMITS.url)
			return { links, error: 'Eine Adresse ist zu lang.' };
		links.push({ label: (label || url).slice(0, RESPONSIBILITY_LIMITS.linkLabel), url });
	}
	if (links.length > RESPONSIBILITY_LIMITS.links)
		return { links, error: `Höchstens ${RESPONSIBILITY_LIMITS.links} Links.` };
	return { links };
}

export function isSafeUrl(url: string): boolean {
	if (/^\/(?!\/)[^\s\\]*$/.test(url)) return true;
	try {
		const u = new URL(url);
		return (u.protocol === 'https:' || u.protocol === 'http:') && Boolean(u.hostname);
	} catch {
		return false;
	}
}

/** Links zurück in die Textform für das Formular. */
export function linksToText(links: { label: string; url: string }[]): string {
	return links
		.map((l) => (l.label && l.label !== l.url ? `${l.label} | ${l.url}` : l.url))
		.join('\n');
}

export function validateResponsibility(input: ResponsibilityInput): {
	value?: CleanResponsibility;
	errors: ResponsibilityErrors;
} {
	const L = RESPONSIBILITY_LIMITS;
	const errors: ResponsibilityErrors = {};
	const topic = input.topic.trim().replace(/\s+/g, ' ');
	if (topic.length < 2 || topic.length > L.topic)
		errors.topic = `Das Thema braucht 2 bis ${L.topic} Zeichen.`;
	const description = input.description.trim();
	if (description.length > L.description)
		errors.description = `Höchstens ${L.description} Zeichen.`;
	const keywords = parseKeywords(input.keywords);
	if (keywords.length > L.keywords) errors.keywords = `Höchstens ${L.keywords} Stichwörter.`;
	else if (keywords.some((k) => k.length > L.keyword))
		errors.keywords = `Ein Stichwort hat höchstens ${L.keyword} Zeichen.`;
	const groupName = input.groupName.trim().replace(/\s+/g, ' ');
	if (groupName.length > L.group) errors.groupName = `Höchstens ${L.group} Zeichen.`;
	const personId = input.personId.trim();
	const deputyId = input.deputyId.trim();
	if (personId && !GUID.test(personId)) errors.personId = 'Bitte wähle eine Person aus dem Team.';
	if (deputyId && !GUID.test(deputyId)) errors.deputyId = 'Bitte wähle eine Person aus dem Team.';
	if (!personId) errors.personId = 'Bitte wähle eine Ansprechperson.';
	if (personId && deputyId && personId === deputyId)
		errors.deputyId = 'Die Vertretung muss eine andere Person sein.';
	const links = parseLinks(input.links);
	if (links.error) errors.links = links.error;
	if (Object.keys(errors).length) return { errors };
	return {
		errors,
		value: {
			topic,
			description: description || null,
			keywords,
			groupName: groupName || null,
			personId: personId || null,
			deputyId: deputyId || null,
			links: links.links
		}
	};
}

/** Für die Suche: klein, ohne Akzente, ß → ss. */
export function normalize(s: string): string {
	return s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Alle Wörter der Suche kommen in einem der Felder vor. */
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
	const words = normalize(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const hay = normalize(fields.filter(Boolean).join(' '));
	return words.every((w) => hay.includes(w));
}

/** Zuständigkeiten in Gruppen; ohne Gruppe zuerst, Reihenfolge bleibt. */
export function groupResponsibilities<T extends { groupName: string | null }>(
	items: T[]
): { group: string | null; items: T[] }[] {
	const groups: { group: string | null; items: T[] }[] = [];
	for (const it of items) {
		let g = groups.find((x) => x.group === it.groupName);
		if (!g) {
			g = { group: it.groupName, items: [] };
			if (it.groupName === null) groups.unshift(g);
			else groups.push(g);
		}
		g.items.push(it);
	}
	return groups;
}

/** Fällig, sobald die letzte Prüfung länger als `months` Monate zurückliegt. */
export function reviewDue(checkedAt: Date | null, months: number): Date | null {
	if (!checkedAt) return null;
	const due = new Date(checkedAt);
	due.setMonth(due.getMonth() + months);
	return due;
}

export function isReviewOverdue(checkedAt: Date | null, months: number, now = new Date()): boolean {
	const due = reviewDue(checkedAt, months);
	return due !== null && due <= now;
}
