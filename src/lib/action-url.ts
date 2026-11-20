/**
 * Adresse für eine Formular-Aktion, die die Suchparameter der Seite behält
 * (Ansicht, Filter). Ohne das landet man nach dem Absenden in der Standardansicht.
 */
export function actionUrl(search: string, name: string): string {
	const q = new URLSearchParams(search);
	for (const k of [...q.keys()]) if (k.startsWith('/') || k === 'neu') q.delete(k);
	const rest = q.toString();
	return `?${rest ? `${rest}&` : ''}/${name}`;
}
