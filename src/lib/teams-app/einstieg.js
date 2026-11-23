// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Skript läuft unverändert im Teams-Tab, ohne Build
// @ts-nocheck -- Skript läuft unverändert im Teams-Tab, ohne Build
/* global microsoftTeams */
/**
 * Einstieg der Teams-App (/teams/app): in Teams per SSO anmelden und dann das
 * Ziel im Intranet öffnen. Außerhalb von Teams geht es direkt weiter.
 */
(function () {
	const status = document.getElementById('status');
	const fehlerBox = document.getElementById('fehler');
	const knopf = document.getElementById('erneut');
	const params = new URLSearchParams(location.search);

	// Gleiche Regeln wie src/lib/ziel.ts: Browser entfernen Tabulator und
	// Zeilenumbruch und lesen „\“ wie „/“, darum beides ablehnen und das
	// Ergebnis gegen die eigene Herkunft prüfen (kein Open Redirect).
	function sicher(ziel) {
		// eslint-disable-next-line no-control-regex -- Steuerzeichen gezielt ablehnen
		if (!ziel || ziel.length > 300 || /[\u0000-\u001f\u007f\\]/.test(ziel)) return '/';
		if (ziel.charAt(0) !== '/' || ziel.charAt(1) === '/') return '/';
		try {
			const u = new URL(ziel, location.origin);
			return u.origin === location.origin ? u.pathname + u.search + u.hash : '/';
		} catch {
			return '/';
		}
	}

	function zeigeFehler(text) {
		status.hidden = true;
		fehlerBox.hidden = false;
		document.getElementById('fehlertext').textContent = text;
	}

	async function anmelden(ziel) {
		status.hidden = false;
		fehlerBox.hidden = true;
		status.textContent = 'Anmeldung läuft …';
		try {
			const schon = await fetch('/teams/anmelden', { credentials: 'include' }).then((r) =>
				r.json()
			);
			if (schon.angemeldet) return location.replace(ziel);
			const token = await microsoftTeams.authentication.getAuthToken();
			const res = await fetch('/teams/anmelden', {
				method: 'POST',
				credentials: 'include',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ ziel })
			});
			const r = await res.json().catch(() => ({}));
			if (!res.ok || !r.ok) return zeigeFehler(r.fehler || 'Die Anmeldung hat nicht geklappt.');
			location.replace(sicher(r.ziel || ziel));
		} catch {
			zeigeFehler(
				'Teams konnte dich nicht anmelden. Versuch es noch einmal oder öffne das Intranet im Browser.'
			);
		}
	}

	// Gleicher Vorsatz wie HINWEIS_PRAEFIX in src/lib/teams.ts
	const HINWEIS = 'hinweis:';
	// entityId des Reiters im Manifest (TEAMS_TAB_ENTITY)
	const REITER = 'intranet';

	/**
	 * Aus dem Aktivitätsfeed: Teams zeigt die App im Aktivitätsbereich. Dort nur
	 * den Hinweis zeigen; der Knopf wechselt in die App und öffnet das Ziel.
	 */
	function zeigeHinweis(ziel, ctx) {
		status.hidden = true;
		document.getElementById('hinweis').hidden = false;
		document.getElementById('hinweisbrowser').href = ziel;
		document.getElementById('zurapp').addEventListener('click', async () => {
			try {
				const pages = microsoftTeams.pages;
				if (pages.currentApp && pages.currentApp.isSupported()) {
					await pages.currentApp.navigateTo({ pageId: REITER, subPageId: ziel });
				} else {
					await pages.navigateToApp({
						appId: String(ctx.app.appId),
						pageId: REITER,
						subPageId: ziel
					});
				}
			} catch {
				zeigeFehler(
					'Teams konnte nicht in die App wechseln. Öffne die Intranet-App links in Teams oder das Intranet im Browser.'
				);
				document.getElementById('erneut').hidden = true;
			}
		});
	}

	async function start() {
		let roh = params.get('ziel');
		let hinweis = false;
		if (roh && roh.indexOf(HINWEIS) === 0) {
			hinweis = true;
			roh = roh.slice(HINWEIS.length);
		}
		let ziel = sicher(roh && roh.charAt(0) !== '{' ? roh : '/');
		try {
			// Außerhalb von Teams antwortet niemand: nach 5 Sekunden aufgeben
			await Promise.race([
				microsoftTeams.app.initialize(),
				new Promise((_, nein) => setTimeout(() => nein(new Error('timeout')), 5000))
			]);
		} catch {
			// nosemgrep: javascript.browser.security.open-redirect.js-open-redirect -- ziel ist durch sicher() auf einen Pfad derselben Herkunft begrenzt
			return location.replace(ziel);
		}
		let ctx = null;
		try {
			ctx = await microsoftTeams.app.getContext();
			let sub = ctx.page && ctx.page.subPageId;
			if (sub && sub.indexOf(HINWEIS) === 0) {
				hinweis = true;
				sub = sub.slice(HINWEIS.length);
			}
			if (ziel === '/' && sub) ziel = sicher(sub);
		} catch {
			/* ohne Kontext zur Startseite */
		}
		try {
			microsoftTeams.app.notifySuccess();
		} catch {
			/* egal */
		}
		if (hinweis && ctx) return zeigeHinweis(ziel, ctx);
		knopf.addEventListener('click', () => anmelden(ziel));
		document.getElementById('browser').href = ziel;
		if (params.has('abgemeldet')) {
			status.textContent = 'Du hast dich abgemeldet.';
			knopf.textContent = 'Wieder anmelden';
			fehlerBox.hidden = false;
			document.getElementById('fehlertext').textContent = '';
			return;
		}
		anmelden(ziel);
	}

	start();
})();
