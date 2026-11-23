/**
 * Umfragen an Beiträgen (Kap. 8.18).
 *
 * Sichtbar ist eine Umfrage für alle, die den Beitrag sehen (getNews prüft
 * das mit RLS). Anlegen, ändern, beenden und alle Ergebnisse sehen darf das
 * Team der Einheit: Recht „Umfragen“, Abteilungsverwaltung bzw. Hub-Team.
 *
 * Anonym: Antworten ohne Person und ohne Zeitstempel, die Teilnahme getrennt
 * davon. Deshalb lässt sich eine anonyme Antwort nicht mehr ändern.
 */
import { and, asc, eq, gt, isNull, notExists, or, sql } from 'drizzle-orm';
import {
	ergebnisSichtbar,
	FRAGE_ARTEN,
	leseAntworten,
	leseUmfrage,
	teamText,
	TERMIN_WAHL,
	type AntwortWert,
	type FrageArt,
	type TerminWahl,
	type UmfrageEingabe
} from '../umfrage.ts';
import { berlinToDate, dateToBerlinInput } from '../news.ts';
import { audit } from './audit.ts';
import { canSeeUnit, canWriteSurveys, type Principal } from './auth/access.ts';
import { db } from './db/index.ts';
import {
	news,
	persons,
	roleAssignments,
	surveyAnswers,
	surveyParticipations,
	surveyQuestions,
	surveys,
	unitMembers,
	units
} from './db/schema.ts';
import { getNews, visibleNewsIds } from './news.ts';
import { getContentRules } from './rules.ts';

export class UmfrageFehler extends Error {}

type Einheit = { id: string; tenantId: string; isCentral: boolean; name: string };

async function einheitVon(newsId: string): Promise<Einheit | null> {
	const [u] = await db
		.select({
			id: units.id,
			tenantId: units.tenantId,
			isCentral: units.isCentral,
			name: units.name
		})
		.from(news)
		.innerJoin(units, eq(units.id, news.unitId))
		.where(eq(news.id, newsId));
	return u ?? null;
}

/** Wer für die Einheit Umfragen anlegen darf (für „Wer sieht was?“). */
export async function umfrageTeam(unitId: string): Promise<string[]> {
	const rows = await db
		.selectDistinct({ name: persons.displayName })
		.from(persons)
		.where(
			and(
				eq(persons.status, 'active'),
				or(
					sql`exists (select 1 from ${unitMembers} m where m.person_id = ${persons.id} and m.unit_id = ${unitId} and m.may_write_surveys)`,
					sql`exists (select 1 from ${roleAssignments} r where r.person_id = ${persons.id} and r.scope_unit_id = ${unitId} and r.role in ('abteilungsverwaltung', 'hub_team'))`
				)
			)
		);
	return rows.map((r) => r.name).sort((a, b) => a.localeCompare(b, 'de'));
}

async function fragenVon(surveyId: string) {
	return db
		.select({
			id: surveyQuestions.id,
			art: surveyQuestions.kind,
			text: surveyQuestions.text,
			pflicht: surveyQuestions.required,
			mehrfach: surveyQuestions.multiple,
			optionen: surveyQuestions.options
		})
		.from(surveyQuestions)
		.where(eq(surveyQuestions.surveyId, surveyId))
		.orderBy(asc(surveyQuestions.position));
}

async function hatAntworten(surveyId: string) {
	const [r] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(surveyParticipations)
		.where(eq(surveyParticipations.surveyId, surveyId));
	return (r?.n ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Anzeigen
// ---------------------------------------------------------------------------

export interface ErgebnisZeile {
	text: string;
	anzahl: number;
	/** Anteil an den Teilnehmenden der Frage, 0–1 */
	anteil: number;
	vorne: boolean;
	zusatz?: string;
}

/** Umfrage eines Beitrags für die Anzeige; null ohne Umfrage oder ohne Sicht. */
export async function umfrageFuerBeitrag(p: Principal, newsId: string) {
	const beitrag = await getNews(p, newsId);
	if (!beitrag) return null;
	const [u] = await db.select().from(surveys).where(eq(surveys.newsId, newsId));
	if (!u) return null;
	const einheit = (await einheitVon(newsId))!;
	const team = canWriteSurveys(p, einheit);
	const fragen = await fragenVon(u.id);
	const [teil] = await db
		.select({ n: sql<number>`1` })
		.from(surveyParticipations)
		.where(
			and(eq(surveyParticipations.surveyId, u.id), eq(surveyParticipations.personId, p.personId))
		);
	const teilgenommen = Boolean(teil);
	const beendet = u.endsAt.getTime() <= Date.now();
	const sichtbar = ergebnisSichtbar({
		team,
		ergebnis: u.results,
		ab: u.resultsFrom,
		teilgenommen,
		beendet
	});
	const [{ n: teilnehmende }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(surveyParticipations)
		.where(eq(surveyParticipations.surveyId, u.id));

	// Eigene Antworten nur bei namentlichen Umfragen (anonym gibt es keine Zuordnung)
	const meine = new Map<string, unknown>();
	if (!u.anonymous && teilgenommen) {
		const rows = await db
			.select({ q: surveyAnswers.questionId, v: surveyAnswers.value })
			.from(surveyAnswers)
			.where(and(eq(surveyAnswers.surveyId, u.id), eq(surveyAnswers.personId, p.personId)));
		for (const r of rows) meine.set(r.q, r.v);
	}

	const ergebnisse = sichtbar ? await auswerten(u.id, fragen, team, u.anonymous) : null;
	return {
		id: u.id,
		anonym: u.anonymous,
		ergebnis: u.results,
		ab: u.resultsFrom,
		endsAt: u.endsAt,
		beendet,
		team,
		teamText: teamText(einheit.name),
		teamNamen: await umfrageTeam(einheit.id),
		teilgenommen,
		teilnehmende,
		aenderbar: !beendet && (!teilgenommen || !u.anonymous),
		fragen: fragen.map((f) => ({ ...f, meine: meine.get(f.id) ?? null })),
		ergebnisse
	};
}

async function auswerten(
	surveyId: string,
	fragen: { id: string; art: FrageArt; optionen: string[] }[],
	team: boolean,
	anonym: boolean
) {
	const rows = await db
		.select({
			q: surveyAnswers.questionId,
			v: surveyAnswers.value,
			name: persons.displayName
		})
		.from(surveyAnswers)
		.leftJoin(persons, eq(persons.id, surveyAnswers.personId))
		.where(eq(surveyAnswers.surveyId, surveyId));
	return fragen.map((f) => {
		const werte = rows.filter((r) => r.q === f.id);
		const n = werte.length;
		const zeilen: ErgebnisZeile[] = [];
		let schnitt: number | null = null;
		let texte: { text: string; name: string | null }[] | null = null;
		if (f.art === 'auswahl') {
			const z = f.optionen.map(() => 0);
			for (const w of werte) for (const i of w.v as number[]) if (i in z) z[i]++;
			const max = Math.max(0, ...z);
			f.optionen.forEach((t, i) =>
				zeilen.push({
					text: t,
					anzahl: z[i],
					anteil: n ? z[i] / n : 0,
					vorne: z[i] === max && max > 0
				})
			);
		} else if (f.art === 'termin') {
			const ja = f.optionen.map(() => 0);
			const vielleicht = f.optionen.map(() => 0);
			for (const w of werte)
				(w.v as TerminWahl[]).forEach((x, i) => {
					if (x === 'ja') ja[i]++;
					if (x === 'vielleicht') vielleicht[i]++;
				});
			const max = Math.max(0, ...ja);
			f.optionen.forEach((t, i) =>
				zeilen.push({
					text: t,
					anzahl: ja[i],
					anteil: n ? ja[i] / n : 0,
					vorne: ja[i] === max && max > 0,
					zusatz: `${vielleicht[i]} ${TERMIN_WAHL.vielleicht.toLowerCase()}`
				})
			);
		} else if (f.art === 'bewertung') {
			const z = [0, 0, 0, 0, 0];
			for (const w of werte) z[(w.v as number) - 1]++;
			schnitt = n ? z.reduce((s, c, i) => s + c * (i + 1), 0) / n : null;
			const max = Math.max(0, ...z);
			for (let i = 4; i >= 0; i--)
				zeilen.push({
					text: `${i + 1} ${i === 0 ? 'Stern' : 'Sterne'}`,
					anzahl: z[i],
					anteil: n ? z[i] / n : 0,
					vorne: z[i] === max && max > 0
				});
		} else if (team) {
			// Freitexte nur für das Team, bei anonymen Umfragen ohne Namen
			texte = werte
				.map((w) => ({ text: String(w.v), name: anonym ? null : w.name }))
				.sort((a, b) => a.text.localeCompare(b.text, 'de'));
		}
		return { frageId: f.id, antworten: n, zeilen, schnitt, texte };
	});
}

// ---------------------------------------------------------------------------
// Teilnehmen
// ---------------------------------------------------------------------------

export async function antwortenSpeichern(p: Principal, newsId: string, form: FormData) {
	const beitrag = await getNews(p, newsId);
	if (!beitrag || beitrag.planned) throw new UmfrageFehler('Diese Umfrage gibt es nicht.');
	const [u] = await db.select().from(surveys).where(eq(surveys.newsId, newsId));
	if (!u) throw new UmfrageFehler('Diese Umfrage gibt es nicht.');
	if (u.endsAt.getTime() <= Date.now()) throw new UmfrageFehler('Die Umfrage ist schon beendet.');
	const fragen = await fragenVon(u.id);
	const { werte, fehlend } = leseAntworten(fragen, form);
	if (fehlend.length) return { fehlend };
	if (werte.size === 0) throw new UmfrageFehler('Bitte beantworte mindestens eine Frage.');

	await db.transaction(async (tx) => {
		const [schon] = await tx
			.select({ n: sql<number>`1` })
			.from(surveyParticipations)
			.where(
				and(eq(surveyParticipations.surveyId, u.id), eq(surveyParticipations.personId, p.personId))
			)
			.for('update');
		if (schon && u.anonymous)
			throw new UmfrageFehler(
				'Du hast schon teilgenommen. Anonyme Antworten lassen sich nicht ändern.'
			);
		if (schon)
			await tx
				.delete(surveyAnswers)
				.where(and(eq(surveyAnswers.surveyId, u.id), eq(surveyAnswers.personId, p.personId)));
		else
			await tx
				.insert(surveyParticipations)
				.values({ surveyId: u.id, personId: p.personId })
				.onConflictDoNothing();
		const response = crypto.randomUUID();
		await tx.insert(surveyAnswers).values(
			[...werte].map(([questionId, value]) => ({
				surveyId: u.id,
				questionId,
				response,
				personId: u.anonymous ? null : p.personId,
				value: value as AntwortWert
			}))
		);
	});
	return { fehlend: [] as string[] };
}

// ---------------------------------------------------------------------------
// Anlegen, ändern, beenden (Team)
// ---------------------------------------------------------------------------

/** Für den Editor: vorhandene Umfrage als Eingabe und ob sie gesperrt ist. */
export async function umfrageFuerEditor(newsId: string) {
	const [u] = await db.select().from(surveys).where(eq(surveys.newsId, newsId));
	if (!u) return { wert: null, gesperrt: false };
	const fragen = await fragenVon(u.id);
	const wert: UmfrageEingabe = {
		anonym: u.anonymous,
		ergebnis: u.results,
		ab: u.resultsFrom,
		ende: dateToBerlinInput(u.endsAt),
		fragen: fragen.map((f) => ({
			art: f.art,
			text: f.text,
			pflicht: f.pflicht,
			mehrfach: f.mehrfach,
			optionen: f.optionen
		}))
	};
	return { wert, gesperrt: await hatAntworten(u.id) };
}

/** Darf die Person für diese Einheit Umfragen anlegen (Regel an, Recht vorhanden)? */
export async function darfUmfragen(
	p: Principal,
	unit: Einheit | { id: string; tenantId: string; isCentral: boolean }
) {
	const regeln = await getContentRules();
	return regeln.surveys && canWriteSurveys(p, unit);
}

/**
 * Nach dem Speichern des Beitrags: Umfrage anlegen, ändern oder entfernen.
 * Nach der ersten Antwort lassen sich nur noch Ende und Sichtbarkeit ändern.
 */
export async function umfrageSpeichern(
	p: Principal,
	newsId: string,
	eingabe: UmfrageEingabe | null,
	ip: string
) {
	const einheit = await einheitVon(newsId);
	if (!einheit) return;
	const [u] = await db.select().from(surveys).where(eq(surveys.newsId, newsId));
	if (!u && !eingabe) return;
	if (!canWriteSurveys(p, einheit))
		throw new UmfrageFehler('Für Umfragen fehlt dir in dieser Einheit das Recht „Umfragen“.');
	if (!u && !(await getContentRules()).surveys)
		throw new UmfrageFehler('Umfragen sind in der Verwaltung ausgeschaltet.');
	const gesperrt = u ? await hatAntworten(u.id) : false;

	if (!eingabe) {
		if (gesperrt)
			throw new UmfrageFehler(
				'Die Umfrage hat schon Antworten. Beende sie, statt sie zu entfernen.'
			);
		await db.delete(surveys).where(eq(surveys.id, u!.id));
		await audit({
			category: 'admin',
			action: 'survey.delete',
			actorId: p.personId,
			details: { newsId },
			ip
		});
		return;
	}
	const ende = berlinToDate(eingabe.ende);
	if (!ende) throw new UmfrageFehler('Bitte gib das Ende der Umfrage an.');
	if (!gesperrt && ende.getTime() <= Date.now())
		throw new UmfrageFehler('Das Ende der Umfrage muss in der Zukunft liegen.');

	await db.transaction(async (tx) => {
		if (u && gesperrt) {
			await tx
				.update(surveys)
				.set({
					results: eingabe.ergebnis,
					resultsFrom: eingabe.ab,
					endsAt: ende,
					updatedAt: new Date()
				})
				.where(eq(surveys.id, u.id));
			return;
		}
		let id = u?.id;
		if (u) {
			await tx
				.update(surveys)
				.set({
					anonymous: eingabe.anonym,
					results: eingabe.ergebnis,
					resultsFrom: eingabe.ab,
					endsAt: ende,
					updatedAt: new Date()
				})
				.where(eq(surveys.id, u.id));
			await tx.delete(surveyQuestions).where(eq(surveyQuestions.surveyId, u.id));
		} else {
			const [neu] = await tx
				.insert(surveys)
				.values({
					newsId,
					anonymous: eingabe.anonym,
					results: eingabe.ergebnis,
					resultsFrom: eingabe.ab,
					endsAt: ende,
					createdBy: p.personId
				})
				.returning({ id: surveys.id });
			id = neu.id;
		}
		await tx.insert(surveyQuestions).values(
			eingabe.fragen.map((f, i) => ({
				surveyId: id!,
				position: i,
				kind: f.art,
				text: f.text,
				required: f.pflicht,
				multiple: f.mehrfach,
				options: f.optionen
			}))
		);
	});
	await audit({
		category: 'admin',
		action: u ? 'survey.update' : 'survey.create',
		actorId: p.personId,
		details: { newsId, fragen: eingabe.fragen.length, anonym: eingabe.anonym },
		ip
	});
}

export async function umfrageBeenden(p: Principal, newsId: string, ip: string) {
	const einheit = await einheitVon(newsId);
	if (!einheit || !canWriteSurveys(p, einheit))
		throw new UmfrageFehler('Dafür fehlt dir das Recht.');
	await db
		.update(surveys)
		.set({ endsAt: new Date(), updatedAt: new Date() })
		.where(and(eq(surveys.newsId, newsId), gt(surveys.endsAt, new Date())));
	await audit({
		category: 'admin',
		action: 'survey.end',
		actorId: p.personId,
		details: { newsId },
		ip
	});
}

// ---------------------------------------------------------------------------
// Auswertung als CSV (Team)
// ---------------------------------------------------------------------------

function zelle(v: string) {
	// Formeln in Tabellenprogrammen entschärfen
	const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
	return `"${t.replace(/"/g, '""')}"`;
}

export async function umfrageCsv(
	p: Principal,
	newsId: string
): Promise<{ name: string; csv: string } | null> {
	const beitrag = await getNews(p, newsId);
	if (!beitrag) return null;
	const einheit = await einheitVon(newsId);
	if (!einheit || !canWriteSurveys(p, einheit)) return null;
	const [u] = await db.select().from(surveys).where(eq(surveys.newsId, newsId));
	if (!u) return null;
	const fragen = await fragenVon(u.id);
	const rows = await db
		.select({
			response: surveyAnswers.response,
			q: surveyAnswers.questionId,
			v: surveyAnswers.value,
			name: persons.displayName
		})
		.from(surveyAnswers)
		.leftJoin(persons, eq(persons.id, surveyAnswers.personId))
		.where(eq(surveyAnswers.surveyId, u.id));
	const abgaben = new Map<string, { name: string | null; werte: Map<string, unknown> }>();
	for (const r of rows) {
		const a = abgaben.get(r.response) ?? { name: r.name, werte: new Map() };
		a.werte.set(r.q, r.v);
		abgaben.set(r.response, a);
	}
	const text = (f: (typeof fragen)[number], v: unknown): string => {
		if (v === undefined || v === null) return '';
		if (f.art === 'auswahl') return (v as number[]).map((i) => f.optionen[i]).join('; ');
		if (f.art === 'termin')
			return (v as TerminWahl[]).map((x, i) => `${f.optionen[i]}: ${TERMIN_WAHL[x]}`).join('; ');
		return String(v);
	};
	const kopf = [
		'Nr.',
		...(u.anonymous ? [] : ['Name']),
		...fragen.map((f, i) => `${i + 1}. ${f.text} (${FRAGE_ARTEN[f.art]})`)
	];
	// Anonym: Reihenfolge zufällig statt nach Abgabe
	const liste = [...abgaben.values()];
	if (u.anonymous) liste.sort(() => Math.random() - 0.5);
	else liste.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'));
	const zeilen = liste.map((a, i) => [
		String(i + 1),
		...(u.anonymous ? [] : [a.name ?? '']),
		...fragen.map((f) => text(f, a.werte.get(f.id)))
	]);
	const csv = '﻿' + [kopf, ...zeilen].map((z) => z.map(zelle).join(';')).join('\r\n');
	await audit({
		category: 'admin',
		action: 'survey.export',
		actorId: p.personId,
		details: { newsId },
		ip: ''
	});
	return { name: 'umfrage.csv', csv };
}

// ---------------------------------------------------------------------------
// Startseite: offene Umfragen ohne eigene Teilnahme
// ---------------------------------------------------------------------------

export async function offeneUmfragen(p: Principal, limit = 5) {
	if (!(await getContentRules()).surveys) return [];
	const rows = await db
		.select({
			newsId: surveys.newsId,
			endsAt: surveys.endsAt,
			title: news.title,
			unitId: units.id,
			unitName: units.name,
			tenantId: units.tenantId,
			isCentral: units.isCentral,
			fragen: sql<number>`(select count(*)::int from ${surveyQuestions} q where q.survey_id = ${surveys.id})`
		})
		.from(surveys)
		.innerJoin(news, eq(news.id, surveys.newsId))
		.innerJoin(units, eq(units.id, news.unitId))
		.where(
			and(
				gt(surveys.endsAt, new Date()),
				isNull(units.archivedAt),
				notExists(
					db
						.select({ x: sql`1` })
						.from(surveyParticipations)
						.where(
							and(
								eq(surveyParticipations.surveyId, surveys.id),
								eq(surveyParticipations.personId, p.personId)
							)
						)
				)
			)
		)
		.orderBy(asc(surveys.endsAt))
		.limit(50);
	const sichtbar = await visibleNewsIds(
		p,
		rows
			.filter((r) => canSeeUnit(p, { id: r.unitId, tenantId: r.tenantId, isCentral: r.isCentral }))
			.map((r) => r.newsId)
	);
	return rows
		.filter((r) => sichtbar.has(r.newsId))
		.slice(0, limit)
		.map((r) => ({
			newsId: r.newsId,
			titel: r.title,
			von: r.unitName,
			endsAt: r.endsAt,
			fragen: r.fragen
		}));
}

/** Absender-Einheiten fürs Beitragsformular um das Umfrage-Recht ergänzen. */
export function mitUmfrageRecht<T extends { id: string; tenantId: string; isCentral: boolean }>(
	p: Principal,
	einheiten: T[]
): (T & { mayUmfrage: boolean })[] {
	return einheiten.map((e) => ({ ...e, mayUmfrage: canWriteSurveys(p, e) }));
}

/**
 * Prüft die Umfrage aus dem Beitragsformular, bevor der Beitrag gespeichert
 * wird – damit kein Beitrag ohne die gewünschte Umfrage entsteht.
 * `aendern: false` heißt: Feld fehlte, Umfrage bleibt, wie sie ist.
 */
export async function umfrageVorpruefen(
	p: Principal,
	einheit: { id: string; tenantId: string; isCentral: boolean } | undefined,
	roh: string | undefined,
	newsId?: string
): Promise<
	| { aendern: false; fehler?: undefined }
	| { aendern: true; wert: UmfrageEingabe | null; fehler?: string }
> {
	if (roh === undefined) return { aendern: false };
	const { wert, fehler } = leseUmfrage(roh);
	if (fehler) return { aendern: true, wert: null, fehler };
	const [u] = newsId
		? await db
				.select({ id: surveys.id })
				.from(surveys)
				.where(eq(surveys.newsId, newsId))
		: [];
	if (!wert && !u) return { aendern: true, wert: null };
	if (!einheit || !canWriteSurveys(p, einheit))
		return {
			aendern: true,
			wert,
			fehler: 'Für Umfragen fehlt dir in dieser Einheit das Recht „Umfragen“.'
		};
	if (!u && !(await getContentRules()).surveys)
		return { aendern: true, wert, fehler: 'Umfragen sind in der Verwaltung ausgeschaltet.' };
	const gesperrt = u ? await hatAntworten(u.id) : false;
	if (!wert && gesperrt)
		return {
			aendern: true,
			wert,
			fehler: 'Die Umfrage hat schon Antworten. Beende sie, statt sie zu entfernen.'
		};
	if (wert && !gesperrt) {
		const ende = berlinToDate(wert.ende);
		if (!ende || ende.getTime() <= Date.now())
			return { aendern: true, wert, fehler: 'Das Ende der Umfrage muss in der Zukunft liegen.' };
	}
	return { aendern: true, wert };
}
