/**
 * Kontaktdaten (Kap. 8.13): Jede Person pflegt Position, Telefon, Mobil,
 * Raum und die Sichtbarkeit der Mobilnummer selbst.
 */
export type MobileVisibility = 'all' | 'team' | 'nobody';

export const MOBILE_VISIBILITY: { key: MobileVisibility; label: string }[] = [
	{ key: 'all', label: 'Alle' },
	{ key: 'team', label: 'Nur mein Team' },
	{ key: 'nobody', label: 'Niemand' }
];

export interface ContactInput {
	position: string;
	phone: string;
	mobile: string;
	mobileVisibility: string;
	room: string;
}

export interface CleanContact {
	position: string | null;
	phone: string | null;
	mobile: string | null;
	mobileVisibility: MobileVisibility;
	room: string | null;
}

export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

/** Ziffern, Leerzeichen, +, /, -, (, ) und Durchwahl mit „-“; 3 bis 30 Zeichen. */
const PHONE = /^\+?[0-9][0-9 ()/-]{1,28}[0-9]$/;

export function validateContact(input: ContactInput): {
	value?: CleanContact;
	errors: ContactErrors;
} {
	const errors: ContactErrors = {};
	const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
	const position = clean(input.position);
	const phone = clean(input.phone);
	const mobile = clean(input.mobile);
	const room = clean(input.room);
	if (position.length > 80) errors.position = 'Höchstens 80 Zeichen.';
	if (phone && !PHONE.test(phone)) errors.phone = 'Bitte nur Ziffern, Leerzeichen, +, /, - und ().';
	if (mobile && !PHONE.test(mobile))
		errors.mobile = 'Bitte nur Ziffern, Leerzeichen, +, /, - und ().';
	if (room.length > 40) errors.room = 'Höchstens 40 Zeichen.';
	const vis = MOBILE_VISIBILITY.find((v) => v.key === input.mobileVisibility)?.key;
	if (!vis) errors.mobileVisibility = 'Bitte wähle, wer die Mobilnummer sieht.';
	if (Object.keys(errors).length) return { errors };
	return {
		errors,
		value: {
			position: position || null,
			phone: phone || null,
			mobile: mobile || null,
			mobileVisibility: vis!,
			room: room || null
		}
	};
}

/** Mobilnummer nur nach Sichtbarkeit: man selbst, Alle, oder Nur mein Team bei gemeinsamer Einheit. */
export function mobileVisible(
	visibility: MobileVisibility,
	isSelf: boolean,
	sharesUnit: boolean
): boolean {
	return isSelf || visibility === 'all' || (visibility === 'team' && sharesUnit);
}
