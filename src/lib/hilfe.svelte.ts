/**
 * Zustand für Führung und Einführungen im Browser (Kap. 13). Welche schon
 * gesehen wurden, kommt aus dem Konto (Layout-Daten) und wird beim Starten
 * oder „Nein danke“ dort gespeichert.
 */
import type { Tour } from './tours.ts';

class Hilfe {
	aktiv = $state<Tour | null>(null);
	gesehen = $state<string[]>([]);

	setzeGesehen(keys: string[]) {
		this.gesehen = keys;
	}

	istGesehen(key: string) {
		return this.gesehen.includes(key);
	}

	async merken(key: string) {
		if (!this.gesehen.includes(key)) this.gesehen = [...this.gesehen, key];
		try {
			await fetch('/hilfe/gesehen', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key })
			});
		} catch {
			// beim nächsten Mal erneut
		}
	}

	starten(tour: Tour) {
		this.aktiv = tour;
		void this.merken(tour.key);
	}

	beenden() {
		this.aktiv = null;
	}
}

export const hilfe = new Hilfe();
