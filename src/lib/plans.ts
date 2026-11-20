/** Regeln für Pläne des KBB (Kap. 8.6), auf Server und im Browser nutzbar. */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface PlanInput {
	title: string;
	validFrom: string;
	validUntil: string;
}

export function validatePlan(p: PlanInput): Partial<Record<keyof PlanInput, string>> {
	const e: Partial<Record<keyof PlanInput, string>> = {};
	const t = p.title.trim();
	if (t.length < 3) e.title = 'Gib bitte einen Titel an, z. B. „Wochenplan KW 48“.';
	else if (t.length > 120) e.title = 'Der Titel darf höchstens 120 Zeichen haben.';
	if (!ISO.test(p.validFrom) || Number.isNaN(Date.parse(p.validFrom)))
		e.validFrom = 'Gib bitte „Gültig ab“ an.';
	if (!ISO.test(p.validUntil) || Number.isNaN(Date.parse(p.validUntil)))
		e.validUntil = 'Gib bitte „Gültig bis“ an.';
	else if (!e.validFrom && p.validUntil < p.validFrom)
		e.validUntil = '„Gültig bis“ darf nicht vor „Gültig ab“ liegen.';
	return e;
}

/** Zustand relativ zum Tag (YYYY-MM-DD, Berlin). */
export function planState(
	p: { validFrom: string; validUntil: string },
	today: string
): 'kuenftig' | 'aktuell' | 'abgelaufen' {
	if (today < p.validFrom) return 'kuenftig';
	if (today > p.validUntil) return 'abgelaufen';
	return 'aktuell';
}

/** „17.11.–23.11.2026“ bzw. „28.12.2026–03.01.2027“ */
export function formatRange(from: string, until: string): string {
	const [fy, fm, fd] = from.split('-');
	const [uy, um, ud] = until.split('-');
	if (from === until) return `${ud}.${um}.${uy}`;
	return fy === uy ? `${fd}.${fm}.–${ud}.${um}.${uy}` : `${fd}.${fm}.${fy}–${ud}.${um}.${uy}`;
}

/** Monat „2026-11“ → „November 2026“ */
export function formatMonth(stand: string): string {
	const [y, m] = stand.split('-').map(Number);
	return new Intl.DateTimeFormat('de-DE', {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(Date.UTC(y, m - 1, 1)));
}
