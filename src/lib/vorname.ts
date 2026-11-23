/**
 * Vorname für die Ansprache per du (Startseite). Aus Entra kommt der Vorname
 * direkt; sonst wird er aus dem Anzeigenamen gelesen: „Nachname, Vorname“
 * oder „Vorname Nachname“, Titel wie „Dr.“ werden übersprungen.
 */
const TITEL = /^(dr|prof|dipl|ing|mag|med|phil|rer|nat)\.?$/i;

export function vorname(displayName: string, givenName?: string | null): string {
	const g = givenName?.trim();
	if (g) return g.split(/\s+/)[0];
	const name = displayName.trim();
	const teil = name.includes(',') ? name.slice(name.indexOf(',') + 1) : name;
	const woerter = teil.split(/\s+/).filter((w) => w && !TITEL.test(w));
	return woerter[0] ?? name;
}
