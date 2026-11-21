// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Skript läuft unverändert im Teams-Tab, ohne Build
// @ts-nocheck -- Skript läuft unverändert im Teams-Tab, ohne Build
/* global microsoftTeams */
/**
 * Test-Tab der Teams-App: prüft, ob das Intranet in Teams laufen kann.
 * Läuft ohne Build-Schritt im Tab (Skript wird von /teams/test/app.js ausgeliefert).
 * Ergebnisse nur zur Anzeige; es entsteht keine Sitzung.
 */
(function () {
	const liste = document.getElementById('ergebnisse');
	const zusammen = [];

	function zeile(titel, ok, text) {
		const li = document.createElement('li');
		li.className = ok === true ? 'ok' : ok === false ? 'fehler' : 'info';
		const z = document.createElement('span');
		z.className = 'zeichen';
		z.setAttribute('aria-hidden', 'true');
		z.textContent = ok === true ? '✓' : ok === false ? '✗' : 'i';
		const t = document.createElement('div');
		const s = document.createElement('strong');
		s.textContent = titel;
		const p = document.createElement('span');
		p.textContent = text;
		t.append(s, p);
		li.append(z, t);
		liste.append(li);
		zusammen.push(`${ok === true ? 'OK' : ok === false ? 'FEHLER' : 'INFO'} | ${titel}: ${text}`);
	}

	async function json(res) {
		try {
			return await res.json();
		} catch {
			return {};
		}
	}

	async function cookieTest() {
		try {
			const setzen = await fetch('/teams/test/cookie', { method: 'POST', credentials: 'include' });
			const gesetzt = await json(setzen);
			const lesen = await fetch('/teams/test/cookie', { credentials: 'include' });
			const gelesen = await json(lesen);
			zeile(
				'Cookie mit „Partitioned“',
				gelesen.partitioniert === gesetzt.wert,
				gelesen.partitioniert === gesetzt.wert
					? 'wird gespeichert und mitgeschickt'
					: 'kommt nicht zurück (Browser sperrt es)'
			);
			zeile(
				'Cookie ohne „Partitioned“',
				gelesen.normal === gesetzt.wert ? true : null,
				gelesen.normal === gesetzt.wert
					? 'wird gespeichert und mitgeschickt'
					: 'kommt nicht zurück (zum Vergleich, nicht nötig)'
			);
		} catch {
			zeile('Cookies', false, 'Server nicht erreichbar');
		}
		try {
			localStorage.setItem('teams-test', '1');
			const ok = localStorage.getItem('teams-test') === '1';
			localStorage.removeItem('teams-test');
			zeile('Lokaler Speicher', ok ? true : null, ok ? 'verfügbar' : 'nicht verfügbar');
		} catch {
			zeile('Lokaler Speicher', null, 'gesperrt (nicht nötig)');
		}
	}

	async function start() {
		if (typeof microsoftTeams === 'undefined') {
			zeile('Teams-Bibliothek', false, 'konnte nicht geladen werden');
			return fertig();
		}
		try {
			// Außerhalb von Teams antwortet niemand: nach 5 Sekunden aufgeben
			await Promise.race([
				microsoftTeams.app.initialize(),
				new Promise((_, nein) => setTimeout(() => nein(new Error('timeout')), 5000))
			]);
		} catch {
			zeile(
				'In Teams geöffnet',
				false,
				'Diese Seite läuft nicht in Teams. Öffne die App „Intranet“ in Teams, Reiter „Test“.'
			);
			await cookieTest();
			return fertig();
		}
		const ctx = await microsoftTeams.app.getContext();
		const host = ctx.app?.host || {};
		zeile('In Teams geöffnet', true, `${host.name || '?'} · ${host.clientType || '?'}`);
		zeile(
			'Sprung aus Benachrichtigung',
			ctx.page?.subPageId ? true : null,
			ctx.page?.subPageId
				? `kam an: ${ctx.page.subPageId}`
				: 'kein Ziel übergeben (normal, wenn du den Reiter selbst geöffnet hast)'
		);
		try {
			const token = await microsoftTeams.authentication.getAuthToken();
			const res = await fetch('/teams/test/token', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` }
			});
			const r = await json(res);
			zeile(
				'Anmeldung per Microsoft-Konto',
				res.ok,
				res.ok
					? `${r.name || r.upn}${r.bekannt ? ' (im Intranet bekannt)' : ' (im Intranet noch nicht angelegt)'}`
					: r.fehler || `Server antwortet ${res.status}`
			);
		} catch (e) {
			const msg = e && e.message ? e.message : String(e);
			zeile(
				'Anmeldung per Microsoft-Konto',
				false,
				`Teams gibt kein Token (${msg}). Prüfe „Expose an API“ in der App-Registrierung.`
			);
		}
		await cookieTest();
		try {
			microsoftTeams.app.notifySuccess();
		} catch {
			/* egal */
		}
		fertig();
	}

	function fertig() {
		const knopf = document.getElementById('kopieren');
		const text = [
			`Teams-Test ${new Date().toLocaleString('de-DE')}`,
			`Browser: ${navigator.userAgent}`,
			...zusammen
		].join('\n');
		document.getElementById('rohtext').textContent = text;
		knopf.hidden = false;
		knopf.addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(text);
				knopf.textContent = 'Kopiert';
			} catch {
				document.getElementById('roh').open = true;
			}
		});
		document.getElementById('status').textContent = 'Test abgeschlossen.';
	}

	start();
})();
