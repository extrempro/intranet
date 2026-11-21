/**
 * Rücksprungziele prüfen (kein Open Redirect), für Server und Browser.
 * Browser entfernen Tabulator und Zeilenumbruch aus Adressen und lesen „\“
 * wie „/“: „/\t/fremd.example“ würde zu „//fremd.example“. Darum Steuerzeichen
 * und Backslash ablehnen und das Ergebnis gegen die eigene Herkunft prüfen.
 */
const BASIS = 'https://intranet.invalid';

export function safeTarget(value: string | null | undefined, max: number): string {
	// eslint-disable-next-line no-control-regex -- Steuerzeichen gezielt ablehnen
	if (!value || value.length > max || /[\u0000-\u001f\u007f\\]/.test(value)) return '/';
	if (!value.startsWith('/') || value.startsWith('//')) return '/';
	let u: URL;
	try {
		u = new URL(value, BASIS);
	} catch {
		return '/';
	}
	if (u.origin !== BASIS) return '/';
	return u.pathname + u.search + u.hash;
}
