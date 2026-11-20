/**
 * Formulare, deren Aktion auf einer anderen Seite liegt (z. B. /konto mit
 * Aktionen unter /konto/profil): Ergebnis anwenden und Daten neu laden, ohne
 * zur Seite der Aktion zu wechseln. Eingaben bleiben stehen.
 */
import { applyAction, type ActionResult } from '$app/forms';
import { invalidateAll } from '$app/navigation';

export async function hierAnwenden(result: ActionResult) {
	if (result.type === 'success' || result.type === 'failure') {
		await applyAction(result);
		await invalidateAll();
	} else {
		await applyAction(result);
	}
}

/** Für use:enhance: Ergebnis auf der aktuellen Seite anwenden. */
export const hierBleiben =
	() =>
	async ({ result }: { result: ActionResult }) =>
		hierAnwenden(result);
