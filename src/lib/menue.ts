/**
 * Hauptmenü auf PC und Tablet: eingeklappt (nur Symbole) oder ausgeklappt,
 * dazu die aufgeklappten Bereiche. Je Gerät im Cookie „intranet-menue“
 * gemerkt, damit der Server gleich richtig zeichnet (kein Flackern).
 */
export const MENUE_COOKIE = 'intranet-menue';

export interface Menuestand {
	/** true: eingeklappt, false: ausgeklappt, null: je nach Breite (Tablet zu, PC auf) */
	zu: boolean | null;
	/** Aufgeklappte Bereiche (Schlüssel aus nav.ts) */
	offen: string[];
}

/** Format: „<z>|<schlüssel>.<schlüssel>“, z = 1 (zu), 0 (auf) oder leer. */
export function menueLesen(wert: string | undefined, erlaubt: readonly string[]): Menuestand {
	const [z = '', o = ''] = (wert ?? '').slice(0, 300).split('|');
	const offen = o.split('.').filter((k, i, alle) => erlaubt.includes(k) && alle.indexOf(k) === i);
	return { zu: z === '1' ? true : z === '0' ? false : null, offen };
}

export function menueWert(s: Menuestand): string {
	return `${s.zu === null ? '' : s.zu ? '1' : '0'}|${s.offen.join('.')}`;
}

/** Cookie im Browser setzen; in Teams (eingebettet) partitioniert. */
export function menueSpeichern(s: Menuestand, inTeams: boolean) {
	const sicher = location.protocol === 'https:';
	const art =
		inTeams && sicher
			? 'SameSite=None; Secure; Partitioned'
			: `SameSite=Lax${sicher ? '; Secure' : ''}`;
	document.cookie = `${MENUE_COOKIE}=${encodeURIComponent(menueWert(s))}; Path=/; Max-Age=31536000; ${art}`;
}
