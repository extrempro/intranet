/**
 * Regeln für Neuigkeiten (Kap. 8.1, 8.2), auf Server und im Browser nutzbar.
 * Zeiten werden in Europe/Berlin eingegeben und als UTC gespeichert.
 */
export const ZONE = 'Europe/Berlin';
const DAY = 24 * 60 * 60 * 1000;

/** Versatz von Europe/Berlin zu UTC in ms zum Zeitpunkt t. */
function berlinOffset(t: number): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: ZONE,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(t));
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second')
	);
	return asUtc - Math.floor(t / 1000) * 1000;
}

/**
 * „2026-11-20T08:00“ (Berliner Ortszeit, wie von datetime-local) → Date.
 * Auch reine Datumsangaben („2026-11-20“) gehen; dann 00:00 Uhr.
 */
export function berlinToDate(local: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(local.trim());
	if (!m) return null;
	const [, y, mo, d, h = '0', mi = '0'] = m;
	const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi);
	if (Number.isNaN(guess)) return null;
	let t = guess - berlinOffset(guess);
	t = guess - berlinOffset(t); // Sommerzeitwechsel
	return new Date(t);
}

/** Date → „YYYY-MM-DDTHH:mm“ in Berliner Ortszeit (für datetime-local). */
export function dateToBerlinInput(d: Date): string {
	const local = new Date(d.getTime() + berlinOffset(d.getTime()));
	return local.toISOString().slice(0, 16);
}

/** Ende eines Kalendertags in Berlin (23:59) – für „Ablauf“ und „Angeheftet bis“ als Datum. */
export function endOfBerlinDay(date: string): Date | null {
	return berlinToDate(`${date}T23:59`);
}

const fmtLong = new Intl.DateTimeFormat('de-DE', {
	timeZone: ZONE,
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	hour: '2-digit',
	minute: '2-digit'
});
const fmtDate = new Intl.DateTimeFormat('de-DE', {
	timeZone: ZONE,
	day: '2-digit',
	month: '2-digit',
	year: 'numeric'
});

export function formatWhen(d: Date): string {
	return `${fmtLong.format(d)} Uhr`;
}

export function formatDay(d: Date): string {
	return fmtDate.format(d);
}

// ---------------------------------------------------------------------------
// Prüfung
// ---------------------------------------------------------------------------

export interface NewsDraft {
	title: string;
	bodyText: string;
	publishAt: Date | null;
	expiresAt: Date | null;
	pinnedUntil: Date | null;
	urgentUntil: Date | null;
	urgentText: string | null;
	/** Zentrale Absender: alle oder einzelne Mandanten. */
	allTenants: boolean;
	tenantIds: string[];
}

export interface NewsContext {
	now: Date;
	unitIsCentral: boolean;
	unitTenantId: string;
	unitMayPostUrgent: boolean;
	pinMaxDays: number;
	urgentMaxDays: number;
	/** Andere aktive dringende Meldungen derselben Einheit. */
	otherActiveUrgent: number;
	urgentPerUnit: number;
	/** Bestehender Beitrag: Freigabe darf in der Vergangenheit bleiben. */
	existingPublishAt?: Date | null;
}

export type NewsErrors = Partial<
	Record<
		| 'title'
		| 'body'
		| 'publishAt'
		| 'expiresAt'
		| 'pinnedUntil'
		| 'urgentUntil'
		| 'urgentText'
		| 'tenants',
		string
	>
>;

export function validateNews(d: NewsDraft, c: NewsContext): NewsErrors {
	const e: NewsErrors = {};
	const now = c.now.getTime();
	if (d.title.trim().length < 3) e.title = 'Gib bitte einen Titel mit mindestens 3 Zeichen ein.';
	else if (d.title.length > 160) e.title = 'Der Titel darf höchstens 160 Zeichen haben.';
	if (d.bodyText.trim().length === 0) e.body = 'Der Beitrag braucht einen Text.';
	else if (d.bodyText.length > 50_000) e.body = 'Der Text ist zu lang.';

	if (!d.publishAt) e.publishAt = 'Gib bitte eine Freigabe an.';
	const start = d.publishAt?.getTime() ?? now;

	if (d.expiresAt && d.expiresAt.getTime() <= start) {
		e.expiresAt = 'Der Ablauf muss nach der Freigabe liegen.';
	}

	if (d.pinnedUntil) {
		if (d.pinnedUntil.getTime() <= Math.max(now, start))
			e.pinnedUntil = '„Angeheftet bis“ muss in der Zukunft liegen.';
		else if (d.pinnedUntil.getTime() > start + c.pinMaxDays * DAY + 60_000) {
			e.pinnedUntil = `Angeheftet geht höchstens ${c.pinMaxDays} Tage.`;
		}
	}

	if (d.urgentUntil || d.urgentText) {
		if (!c.unitMayPostUrgent)
			e.urgentUntil = 'Diese Einheit darf keine dringenden Meldungen senden.';
		else if (!d.urgentUntil) e.urgentUntil = '„Dringend bis“ ist Pflicht.';
		else if (d.urgentUntil.getTime() <= Math.max(now, start))
			e.urgentUntil = '„Dringend bis“ muss in der Zukunft liegen.';
		else if (d.urgentUntil.getTime() > start + c.urgentMaxDays * DAY + 60_000) {
			e.urgentUntil = `Dringend geht höchstens ${c.urgentMaxDays} Tage.`;
		} else if (c.otherActiveUrgent >= c.urgentPerUnit) {
			e.urgentUntil = `Deine Einheit hat schon ${c.urgentPerUnit === 1 ? 'eine dringende Meldung' : `${c.urgentPerUnit} dringende Meldungen`}. Beende sie zuerst.`;
		}
		if (!d.urgentText?.trim()) e.urgentText = 'Gib bitte den Text für das Banner ein.';
		else if (d.urgentText.length > 280)
			e.urgentText = 'Der Bannertext darf höchstens 280 Zeichen haben.';
		if (d.urgentUntil && d.expiresAt && d.expiresAt < d.urgentUntil) {
			e.expiresAt = 'Der Ablauf darf nicht vor „Dringend bis“ liegen.';
		}
	}

	if (c.unitIsCentral) {
		if (!d.allTenants && d.tenantIds.length === 0)
			e.tenants = 'Wähle bitte mindestens einen Mandanten.';
	}
	return e;
}

/** Zielmandanten: Nicht-zentrale Einheiten immer nur der eigene (Kap. 8.1). */
export function effectiveTargets(
	d: Pick<NewsDraft, 'allTenants' | 'tenantIds'>,
	c: Pick<NewsContext, 'unitIsCentral' | 'unitTenantId'>
) {
	if (!c.unitIsCentral) return { allTenants: false, tenantIds: [c.unitTenantId] };
	return d.allTenants
		? { allTenants: true, tenantIds: [] }
		: { allTenants: false, tenantIds: [...new Set(d.tenantIds)] };
}

// ---------------------------------------------------------------------------
// Zustand und Ablauf
// ---------------------------------------------------------------------------

export interface NewsTimes {
	publishAt: Date;
	expiresAt: Date | null;
	pinnedUntil: Date | null;
	urgentUntil: Date | null;
}

export function newsState(n: NewsTimes, now = new Date()) {
	const t = now.getTime();
	return {
		planned: n.publishAt.getTime() > t,
		expired: n.expiresAt !== null && n.expiresAt.getTime() <= t,
		pinned: n.pinnedUntil !== null && n.pinnedUntil.getTime() > t,
		urgent: n.urgentUntil !== null && n.urgentUntil.getTime() > t && n.publishAt.getTime() <= t,
		wasUrgent: n.urgentUntil !== null && n.urgentUntil.getTime() <= t
	};
}

/** „So läuft der Beitrag ab“ (Kap. 8.2) – in einfachen Sätzen. */
export function lifecycle(n: Partial<NewsTimes>, now = new Date()): string[] {
	const out: string[] = [];
	if (!n.publishAt || n.publishAt.getTime() <= now.getTime() + 60_000)
		out.push('Erscheint sofort nach dem Speichern.');
	else
		out.push(
			`Erscheint am ${formatWhen(n.publishAt)}. Bis dahin sehen ihn nur deine Einheit und die Redaktion.`
		);
	if (n.urgentUntil) {
		out.push(`Steht bis ${formatWhen(n.urgentUntil)} als rotes Banner oben auf der Startseite.`);
		out.push('Danach bleibt er als normale Neuigkeit mit dem Hinweis „War dringend bis …“ stehen.');
	}
	if (n.pinnedUntil) out.push(`Bleibt bis ${formatWhen(n.pinnedUntil)} oben angeheftet.`);
	if (n.expiresAt) out.push(`Verschwindet am ${formatWhen(n.expiresAt)}.`);
	else out.push('Bleibt dauerhaft sichtbar.');
	return out;
}
