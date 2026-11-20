/**
 * Rechtliches (Kap. 8.10): Arten und Prüfung der Eingaben.
 */
import { isSafeUrl } from './departments.ts';

export const AGREEMENT_KINDS = [
	{ key: 'betrieb', label: 'Betriebsvereinbarungen', single: 'Betriebsvereinbarung' },
	{ key: 'dienst', label: 'Dienstvereinbarungen', single: 'Dienstvereinbarung' }
] as const;
export type AgreementKind = (typeof AGREEMENT_KINDS)[number]['key'];

export const LEGAL_KINDS = [
	{ key: 'gesetz', label: 'Gesetze' },
	{ key: 'tarif', label: 'Tarifverträge' }
] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number]['key'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: string): boolean {
	if (!DATE.test(s)) return false;
	const d = new Date(`${s}T12:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export interface AgreementInput {
	kind: string;
	title: string;
	description: string;
	versionDate: string;
	validFrom: string;
}

export type AgreementErrors = Partial<
	Record<keyof AgreementInput | 'attachments' | 'tenantId', string>
>;

export function validateAgreement(input: AgreementInput): AgreementErrors {
	const e: AgreementErrors = {};
	if (!AGREEMENT_KINDS.some((k) => k.key === input.kind)) e.kind = 'Bitte wähle die Art.';
	const title = input.title.trim();
	if (title.length < 3 || title.length > 200) e.title = 'Der Titel braucht 3 bis 200 Zeichen.';
	if (input.description.trim().length > 1000) e.description = 'Höchstens 1000 Zeichen.';
	if (!validDate(input.versionDate)) e.versionDate = 'Bitte gib den Stand als Datum an.';
	if (!validDate(input.validFrom)) e.validFrom = 'Bitte gib an, ab wann die Vereinbarung gilt.';
	return e;
}

export interface LegalLinkInput {
	kind: string;
	title: string;
	description: string;
	url: string;
}

export type LegalLinkErrors = Partial<Record<keyof LegalLinkInput | 'file', string>>;

/** Link oder Datei: mindestens eines von beiden (die Datei prüft der Server). */
export function validateLegalLink(input: LegalLinkInput, hasFile: boolean): LegalLinkErrors {
	const e: LegalLinkErrors = {};
	if (!LEGAL_KINDS.some((k) => k.key === input.kind)) e.kind = 'Bitte wähle die Art.';
	const title = input.title.trim();
	if (title.length < 2 || title.length > 200) e.title = 'Der Titel braucht 2 bis 200 Zeichen.';
	if (input.description.trim().length > 500) e.description = 'Höchstens 500 Zeichen.';
	const url = input.url.trim();
	if (url && (url.length > 500 || !isSafeUrl(url)))
		e.url = 'Bitte eine Adresse mit https:// oder einen Pfad im Intranet angeben.';
	if (!url && !hasFile) e.url = 'Bitte gib einen Link an oder lade eine Datei hoch.';
	return e;
}
