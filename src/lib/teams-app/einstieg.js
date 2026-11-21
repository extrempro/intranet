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

	function sicher(ziel) {
		if (!ziel || ziel.charAt(0) !== '/' || ziel.charAt(1) === '/' || ziel.charAt(1) === '\\')
			return '/';
		return ziel.slice(0, 300);
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
			location.replace(r.ziel || ziel);
		} catch {
			zeigeFehler(
				'Teams konnte dich nicht anmelden. Versuch es noch einmal oder öffne das Intranet im Browser.'
			);
		}
	}

	async function start() {
		const roh = params.get('ziel');
		let ziel = sicher(roh && roh.charAt(0) !== '{' ? roh : '/');
		try {
			// Außerhalb von Teams antwortet niemand: nach 5 Sekunden aufgeben
			await Promise.race([
				microsoftTeams.app.initialize(),
				new Promise((_, nein) => setTimeout(() => nein(new Error('timeout')), 5000))
			]);
		} catch {
			return location.replace(ziel);
		}
		try {
			const ctx = await microsoftTeams.app.getContext();
			if (ziel === '/' && ctx.page && ctx.page.subPageId) ziel = sicher(ctx.page.subPageId);
		} catch {
			/* ohne Kontext zur Startseite */
		}
		try {
			microsoftTeams.app.notifySuccess();
		} catch {
			/* egal */
		}
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
