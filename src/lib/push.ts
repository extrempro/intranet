/**
 * Web Push (Kap. 11.1): Prüfungen, die Browser und Server teilen.
 * Push-Endpunkte kommen vom Browser; damit der Server keine beliebigen
 * Adressen aufruft (SSRF), sind nur bekannte Push-Dienste erlaubt.
 */

const PUSH_HOSTS = [
	'fcm.googleapis.com', // Chrome, Edge (Chromium), Android
	'push.services.mozilla.com', // Firefox
	'notify.windows.com', // ältere Edge-Versionen
	'push.apple.com' // Safari, iPhone (ab „Zum Home-Bildschirm“)
];

export function isAllowedPushEndpoint(raw: string): boolean {
	if (raw.length > 1000) return false;
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		return false;
	}
	if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443'))
		return false;
	const host = u.hostname.toLowerCase();
	return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

const B64URL = /^[A-Za-z0-9_-]+$/;

/** Schlüssel des Abos (Base64url): p256dh 65 Byte, auth 16 Byte. */
export function isValidSubscriptionKeys(p256dh: string, auth: string): boolean {
	return (
		B64URL.test(p256dh) &&
		B64URL.test(auth) &&
		p256dh.length >= 86 &&
		p256dh.length <= 90 &&
		auth.length >= 21 &&
		auth.length <= 24
	);
}

/** Kurze Gerätebeschreibung aus dem User-Agent, z. B. „Chrome auf Windows“. */
export function deviceLabel(ua: string): string {
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /Firefox\//.test(ua)
			? 'Firefox'
			: /Chrome\//.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: 'Browser';
	const system = /iPhone|iPad/.test(ua)
		? 'iPhone/iPad'
		: /Android/.test(ua)
			? 'Android'
			: /Windows/.test(ua)
				? 'Windows'
				: /Mac OS X|Macintosh/.test(ua)
					? 'Mac'
					: /Linux/.test(ua)
						? 'Linux'
						: 'unbekanntem Gerät';
	return `${browser} auf ${system}`;
}

/** Nur eigene Pfade als Ziel beim Antippen (kein offener Redirect). */
export function safePushLink(link: string): string {
	return /^\/(?!\/)[^\s\\]*$/.test(link) ? link : '/benachrichtigungen';
}
