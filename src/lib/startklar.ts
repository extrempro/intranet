/**
 * Startklar-Prüfung (Verwaltung → System): bewertet die Einrichtung vor dem
 * Start und danach. Reine Bewertung ohne Ein-/Ausgabe, damit testbar; die
 * Werte sammelt src/lib/server/startklar.ts. Anleitung: docs/inbetriebnahme.md.
 */

export type Stufe = 'ok' | 'warnung' | 'fehler' | 'info';

export interface Pruefpunkt {
	id: string;
	titel: string;
	stufe: Stufe;
	text: string;
	/** Wo es sich einstellen lässt (Pfad in der Verwaltung) */
	link?: string;
}

export interface StartklarEingaben {
	origin: string | null;
	addressHeader: string | null;
	/** Adresse, die die Anwendung für diese Anfrage erkannt hat */
	erkannteAdresse: string | null;
	entra: boolean;
	/** Letzter Entra-Abgleich */
	abgleich: { ok: boolean; zeit: string } | null;
	/** Aktive lokale Konten mit Rolle System-Admin (Notfallzugang) */
	lokaleSystemAdmins: number;
	mail: boolean;
	sicherung: { eingerichtet: boolean; befunde: { stufe: 'fehler' | 'warnung'; text: string }[] };
	push: boolean;
	rechtliches: { datenschutz: boolean; impressum: boolean };
	teams: {
		aktiv: boolean;
		/** App-ID im Manifest; appIdFest: per TEAMS_APP_ID in der .env festgelegt */
		appId?: string;
		appIdFest?: boolean;
		letzte: { ok: boolean; meldung: string } | null;
	};
	migrationen: { vorhanden: number | null; eingespielt: number | null };
}

const STUNDE = 3_600_000;

/** Private, Loopback- und Docker-Adressen: dann sieht die Anwendung nur den Proxy */
export function istInterneAdresse(ip: string): boolean {
	const a = ip.replace(/^::ffff:/, '');
	return (
		/^(10|127)\./.test(a) ||
		/^192\.168\./.test(a) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(a) ||
		/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a) ||
		a === '::1' ||
		/^f[cd]/i.test(a)
	);
}

export function bewerteStartklar(e: StartklarEingaben, jetzt = Date.now()): Pruefpunkt[] {
	const p: Pruefpunkt[] = [];

	// Adresse
	if (!e.origin)
		p.push({
			id: 'origin',
			titel: 'Adresse des Intranets',
			stufe: 'fehler',
			text: 'ORIGIN fehlt in der .env. Ohne sie klappen Anmeldung mit Microsoft, Passkeys und Links in E-Mails nicht.'
		});
	else if (!e.origin.startsWith('https://'))
		p.push({
			id: 'origin',
			titel: 'Adresse des Intranets',
			stufe: 'fehler',
			text: `ORIGIN ist ${e.origin}. Im Betrieb muss die Adresse mit https:// beginnen (Cookies, Passkeys, App-Installation).`
		});
	else p.push({ id: 'origin', titel: 'Adresse des Intranets', stufe: 'ok', text: e.origin });

	// Echte Adresse hinter dem Proxy
	if (!e.addressHeader)
		p.push({
			id: 'proxy',
			titel: 'Adressen hinter dem Reverse Proxy',
			stufe: 'warnung',
			text: 'ADDRESS_HEADER ist nicht gesetzt. Begrenzungen je IP gelten dann für alle gemeinsam, und das Protokoll zeigt überall die Adresse des Proxys.'
		});
	else if (e.erkannteAdresse && istInterneAdresse(e.erkannteAdresse))
		p.push({
			id: 'proxy',
			titel: 'Adressen hinter dem Reverse Proxy',
			stufe: 'warnung',
			text: `Erkannt wird ${e.erkannteAdresse}, eine interne Adresse. Prüfe XFF_DEPTH oder ob du gerade aus dem internen Netz zugreifst.`
		});
	else
		p.push({
			id: 'proxy',
			titel: 'Adressen hinter dem Reverse Proxy',
			stufe: 'ok',
			text: `${e.addressHeader}, erkannt: ${e.erkannteAdresse ?? 'unbekannt'}`
		});

	// Microsoft
	if (!e.entra)
		p.push({
			id: 'entra',
			titel: 'Anmeldung mit Microsoft',
			stufe: 'warnung',
			text: 'Nicht eingerichtet. Ohne sie gibt es nur lokale Konten, keinen Abgleich und keine Teams-App.',
			link: '/verwaltung/anmeldung'
		});
	else if (!e.abgleich)
		p.push({
			id: 'entra',
			titel: 'Anmeldung mit Microsoft',
			stufe: 'warnung',
			text: 'Eingerichtet, der Abgleich mit Entra ist aber noch nie gelaufen. Unter Anmeldung „Verbindung prüfen“ und „Jetzt abgleichen“.',
			link: '/verwaltung/anmeldung'
		});
	else if (!e.abgleich.ok)
		p.push({
			id: 'entra',
			titel: 'Anmeldung mit Microsoft',
			stufe: 'fehler',
			text: 'Der letzte Abgleich mit Entra ist fehlgeschlagen.',
			link: '/verwaltung/anmeldung'
		});
	else if (jetzt - Date.parse(e.abgleich.zeit) > 26 * STUNDE)
		p.push({
			id: 'entra',
			titel: 'Anmeldung mit Microsoft',
			stufe: 'warnung',
			text: 'Der letzte erfolgreiche Abgleich ist älter als einen Tag.',
			link: '/verwaltung/anmeldung'
		});
	else
		p.push({
			id: 'entra',
			titel: 'Anmeldung mit Microsoft',
			stufe: 'ok',
			text: 'Eingerichtet, Abgleich läuft.',
			link: '/verwaltung/anmeldung'
		});

	// Notfallzugang
	p.push(
		e.lokaleSystemAdmins > 0
			? {
					id: 'notfall',
					titel: 'Notfallzugang',
					stufe: 'ok',
					text: `${e.lokaleSystemAdmins === 1 ? 'Ein lokales Konto' : `${e.lokaleSystemAdmins} lokale Konten`} mit Rolle System-Admin.`,
					link: '/verwaltung/benutzer'
				}
			: {
					id: 'notfall',
					titel: 'Notfallzugang',
					stufe: 'warnung',
					text: 'Kein lokales Konto mit Rolle System-Admin. Fällt Microsoft aus oder ist Entra falsch eingestellt, kommt niemand mehr in die Verwaltung.',
					link: '/verwaltung/einladen'
				}
	);

	// E-Mail
	p.push(
		e.mail
			? {
					id: 'mail',
					titel: 'E-Mail-Versand',
					stufe: 'ok',
					text: 'SMTP eingerichtet. Mit „Test-E-Mail an mich“ prüfen.',
					link: '/verwaltung/benachrichtigungen'
				}
			: {
					id: 'mail',
					titel: 'E-Mail-Versand',
					stufe: 'fehler',
					text: 'Kein SMTP-Server. Einladungen, „Passwort vergessen“ und E-Mail-Benachrichtigungen gehen nicht raus.',
					link: '/verwaltung/benachrichtigungen'
				}
	);

	// Sicherung
	if (!e.sicherung.eingerichtet)
		p.push({
			id: 'sicherung',
			titel: 'Sicherung',
			stufe: 'fehler',
			text: 'Der Dienst backup ist nicht eingebunden (BACKUP_DIR fehlt).'
		});
	else {
		const f = e.sicherung.befunde.find((b) => b.stufe === 'fehler');
		const w = e.sicherung.befunde.find((b) => b.stufe === 'warnung');
		p.push({
			id: 'sicherung',
			titel: 'Sicherung',
			stufe: f ? 'fehler' : w ? 'warnung' : 'ok',
			text: (f ?? w)?.text ?? 'Letzte Sicherung und Wiederherstellungstest in Ordnung.'
		});
	}

	// Push
	p.push(
		e.push
			? { id: 'push', titel: 'Push-Benachrichtigungen', stufe: 'ok', text: 'Schlüssel vorhanden.' }
			: {
					id: 'push',
					titel: 'Push-Benachrichtigungen',
					stufe: 'warnung',
					text: 'Noch keine Schlüssel. Die Anwendung legt sie beim Start an; prüfe ENCRYPTION_KEY und die Logs.'
				}
	);

	// Rechtliches
	const fehlt = [
		e.rechtliches.datenschutz ? null : 'Datenschutz',
		e.rechtliches.impressum ? null : 'Impressum'
	].filter(Boolean);
	p.push(
		fehlt.length
			? {
					id: 'rechtliches',
					titel: 'Datenschutz und Impressum',
					stufe: 'warnung',
					text: `Beim Hauptmandanten fehlt der Link zu ${fehlt.join(' und ')}. Das Portal ist öffentlich erreichbar, die Anmeldeseite sollte beides zeigen.`,
					link: '/verwaltung/mandanten'
				}
			: {
					id: 'rechtliches',
					titel: 'Datenschutz und Impressum',
					stufe: 'ok',
					text: 'Links hinterlegt.',
					link: '/verwaltung/mandanten'
				}
	);

	// Teams
	if (!e.teams.aktiv)
		p.push({
			id: 'teams',
			titel: 'Teams-App',
			stufe: 'info',
			text: 'Nicht eingeschaltet.',
			link: '/verwaltung/benachrichtigungen'
		});
	else if (e.teams.letzte && !e.teams.letzte.ok)
		p.push({
			id: 'teams',
			titel: 'Teams-App',
			stufe: 'fehler',
			text: `Letzte Meldung an Teams fehlgeschlagen: ${e.teams.letzte.meldung}`,
			link: '/verwaltung/benachrichtigungen'
		});
	else if (e.teams.appIdFest === false)
		p.push({
			id: 'teams',
			titel: 'Teams-App',
			stufe: 'warnung',
			text: `Eingeschaltet, aber die App-ID ist nicht in der .env festgelegt. Trage TEAMS_APP_ID=${e.teams.appId ?? '…'} ein, sonst bekommt die Teams-App bei einer neuen Datenbank eine neue ID und Teams meldet „App nicht gefunden“.`,
			link: '/verwaltung/benachrichtigungen'
		});
	else
		p.push({
			id: 'teams',
			titel: 'Teams-App',
			stufe: 'ok',
			text: 'Eingeschaltet.',
			link: '/verwaltung/benachrichtigungen'
		});

	// Datenbank
	const { vorhanden, eingespielt } = e.migrationen;
	p.push(
		vorhanden !== null && vorhanden === eingespielt
			? { id: 'datenbank', titel: 'Datenbank', stufe: 'ok', text: 'Alle Migrationen eingespielt.' }
			: {
					id: 'datenbank',
					titel: 'Datenbank',
					stufe: 'fehler',
					text: `Migrationen: ${eingespielt ?? '?'} von ${vorhanden ?? '?'} eingespielt. Logs der Anwendung prüfen.`
				}
	);

	return p;
}
