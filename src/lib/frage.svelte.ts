/**
 * Bestätigungen (Design-Regel): Jede Rückfrage vor einer Aktion erscheint
 * als eigenes Fenster (FrageDialog.svelte), nie als Zeile im Formular.
 * PC und Tablet: Fenster in der Mitte; Handy: Fenster von unten.
 *
 *   if (await frage({ titel: 'Beitrag löschen?', ja: 'Löschen', gefahr: true })) …
 *
 * Für Formulare gibt es MitFrage.svelte (Knopf + Rückfrage + Formular).
 */
export interface Frage {
	titel: string;
	/** Erklärung unter dem Titel, z. B. was passiert */
	text?: string;
	/** Beschriftung des Bestätigungsknopfs, z. B. „Löschen“ */
	ja: string;
	nein?: string;
	/** Endgültig (rot, Fokus zuerst auf „Abbrechen“) */
	gefahr?: boolean;
}

interface Offen extends Frage {
	antwort: (ja: boolean) => void;
}

class FrageZustand {
	aktiv = $state<Offen | null>(null);
}

export const frageZustand = new FrageZustand();

export function frage(f: Frage): Promise<boolean> {
	// Eine offene Frage wird mit „nein“ beendet
	frageZustand.aktiv?.antwort(false);
	return new Promise((ok) => {
		frageZustand.aktiv = {
			...f,
			antwort: (ja) => {
				frageZustand.aktiv = null;
				ok(ja);
			}
		};
	});
}
