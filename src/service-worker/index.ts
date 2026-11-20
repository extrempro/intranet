/**
 * Service Worker (PWA): App-Grundgerüst offline, Offline-Seite, offline
 * gespeicherte Pläne (Kap. 8.6) und Web Push (Kap. 11.1). Seiten und Daten
 * werden nicht zwischengespeichert – nur die Pläne, die jemand ausdrücklich
 * offline speichert. Beim Abmelden löscht der Server alles (Clear-Site-Data).
 */
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';

const SHELL = `intranet-shell-${version}`;
const PLAENE = 'intranet-plaene';
// Pfade sind relativ zur Basis; im Cache und beim Vergleich mit führendem „/“
const ASSETS = [...immutable, ...assets].map((a) => `/${String(a.path).replace(/^\//, '')}`);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k.startsWith('intranet-shell-') && k !== SHELL)
						.map((k) => caches.delete(k))
				)
			)
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;

	// Statische Dateien des aktuellen Builds: aus dem Cache
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((r) => r ?? fetch(req)));
		return;
	}

	// Dateien: online immer frisch (mit Rechteprüfung), offline aus den gespeicherten Plänen
	if (/^\/dateien\/[0-9a-f-]{36}$/i.test(url.pathname)) {
		event.respondWith(
			fetch(req).catch(async () => {
				const hit = await (await caches.open(PLAENE)).match(url.pathname);
				return hit ?? Response.error();
			})
		);
		return;
	}

	// Seiten: ohne Verbindung die Offline-Seite
	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req).catch(async () => (await caches.match('/offline.html')) ?? Response.error())
		);
	}
});

// ---------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------

interface PushData {
	title?: string;
	body?: string;
	link?: string;
	tag?: string;
}

sw.addEventListener('push', (event) => {
	let data: PushData;
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { title: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title || 'Intranet', {
			body: data.body || '',
			tag: data.tag,
			icon: '/icons/icon-192.png',
			badge: '/icons/badge-96.png',
			lang: 'de',
			data: { link: data.link || '/benachrichtigungen' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const raw = String(event.notification.data?.link ?? '/');
	// Nur eigene Pfade öffnen
	const target = new URL(/^\/(?!\/)/.test(raw) ? raw : '/', sw.location.origin).href;
	event.waitUntil(
		(async () => {
			const tabs = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const tab = tabs.find((c) => new URL(c.url).origin === sw.location.origin);
			if (tab) {
				await tab.focus();
				await tab.navigate(target).catch(() => sw.clients.openWindow(target));
			} else await sw.clients.openWindow(target);
		})()
	);
});
