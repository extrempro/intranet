<script lang="ts">
	import TeamsAussehen from '#lib/components/TeamsAussehen.svelte';
	import { enhance } from '$app/forms';
	import Info from '#lib/components/Info.svelte';
	import { SMTP_SECURITY } from '#lib/mail-config.ts';

	let { data, form } = $props();
	const p = $derived(data.push);
	const bereich = (b: string) =>
		form && 'bereich' in form && form.bereich === b
			? (form as Record<string, unknown> & {
					fehler?: string;
					ergebnis?: string;
					gespeichert?: boolean;
				})
			: null;
	const ff = $derived(
		(form && 'felder' in form && form.felder ? form.felder : {}) as Record<string, string>
	);
	/** Nach einem Fehler die Eingabe behalten, sonst den gespeicherten Wert */
	const wert = (name: string, gespeichert: string | undefined) =>
		form && 'werte' in form && form.werte
			? String((form.werte as Record<string, string>)[name] ?? '')
			: (gespeichert ?? '');
	let sende = $state(false);
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
</script>

<svelte:head><title>Benachrichtigungen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<h1>Benachrichtigungen</h1>
	{#if form && 'ergebnis' in form && !('bereich' in form)}
		<p class="meldung" role="status">{form.ergebnis}</p>
	{/if}

	<section class="karte stapel" aria-labelledby="h-push">
		<h2 id="h-push">Web Push</h2>
		<dl class="daten">
			<div>
				<dt>Schlüssel (VAPID)</dt>
				<dd>{p.keys ? 'eingerichtet' : 'fehlen'}</dd>
			</div>
			<div>
				<dt>Kontakt für Push-Dienste</dt>
				<dd>{p.contact}</dd>
			</div>
			<div>
				<dt>Geräte mit Push</dt>
				<dd>{p.devices} ({p.persons} Personen)</dd>
			</div>
			<div>
				<dt>Wartend (Ruhezeit)</dt>
				<dd>{p.waiting}</dd>
			</div>
		</dl>
		<p class="hinweis">
			Ausgehend braucht der Server HTTPS zu den Push-Diensten: fcm.googleapis.com,
			*.push.services.mozilla.com, *.push.apple.com und *.notify.windows.com. Den Kontakt änderst du
			mit der Umgebungsvariable PUSH_CONTACT.
		</p>
		<form method="POST" action="?/test" use:enhance>
			<button class="knopf zweit" type="submit">Testnachricht an meine Geräte</button>
		</form>
	</section>

	<section class="karte stapel" aria-labelledby="h-mail">
		<h2 id="h-mail">
			E-Mail (SMTP)
			<Info
				thema="E-Mail"
				text="Für Einladungen, „Passwort vergessen“ und Benachrichtigungen per E-Mail. Leere Felder nehmen den Wert aus der .env. Das Passwort wird verschlüsselt gespeichert und nie wieder angezeigt."
			/>
		</h2>
		<p>
			{data.mail
				? 'Der E-Mail-Versand ist eingerichtet.'
				: 'Der E-Mail-Versand ist noch nicht eingerichtet: Es fehlen SMTP-Server oder Absender.'}
		</p>
		{#if data.smtp}
			{@const g = data.smtp.gilt}
			{@const v = data.smtp.gespeichert}
			{#if g.security === 'none' || g.insecure}
				<p class="meldung warnung">
					{g.security === 'none'
						? 'E-Mails gehen unverschlüsselt zum SMTP-Server. Das ist nur für einen Relay im internen Netz vertretbar: Einladungs- und Passwort-Links sind sonst mitlesbar.'
						: 'Das Zertifikat des SMTP-Servers wird nicht geprüft. Ein Angreifer im Netz könnte sich dazwischenschalten und Einladungs- und Passwort-Links mitlesen.'}
				</p>
			{/if}
			{#if bereich('smtp')?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
			{#if bereich('smtp')?.fehler}<p class="meldung fehler" role="alert">
					{bereich('smtp')?.fehler}
				</p>{/if}
			<form
				method="POST"
				action="?/smtp"
				class="felder"
				autocomplete="off"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				<div class="zwei">
					<label class="feld">
						<span>SMTP-Server</span>
						<input
							name="host"
							value={wert('host', v.host)}
							placeholder={g.host && !v.host ? `aus .env: ${g.host}` : 'smtp.example.de'}
							spellcheck="false"
							aria-invalid={ff.host ? 'true' : undefined}
						/>
						{#if ff.host}<span class="feldfehler">{ff.host}</span>{/if}
					</label>
					<label class="feld">
						<span>Port</span>
						<input
							name="port"
							inputmode="numeric"
							value={wert('port', v.port?.toString())}
							placeholder={String(g.port)}
							aria-invalid={ff.port ? 'true' : undefined}
						/>
						{#if ff.port}<span class="feldfehler">{ff.port}</span>{/if}
					</label>
				</div>
				<fieldset>
					<legend>Verschlüsselung</legend>
					<div role="radiogroup" aria-label="Verschlüsselung" class="reihe">
						{#each SMTP_SECURITY as s (s.key)}
							<label class="option">
								<input type="radio" name="security" value={s.key} checked={g.security === s.key} />
								{s.label}
							</label>
						{/each}
					</div>
				</fieldset>
				<div class="zwei gleich">
					<label class="feld">
						<span>Benutzer <span class="optional">(optional)</span></span>
						<input
							name="user"
							value={wert('user', v.user)}
							placeholder={g.user && !v.user ? `aus .env: ${g.user}` : 'ohne Anmeldung'}
							autocomplete="off"
							spellcheck="false"
						/>
					</label>
					<label class="feld">
						<span>Passwort</span>
						<input
							name="passwort"
							type="password"
							autocomplete="new-password"
							maxlength="500"
							placeholder={data.smtp.passwortGespeichert
								? 'gespeichert (leer = behalten)'
								: g.password === 'env'
									? 'aus .env (SMTP_PASSWORD)'
									: 'kein Passwort'}
						/>
					</label>
				</div>
				{#if data.smtp.passwortGespeichert}
					<label class="option">
						<input type="checkbox" name="passwortLoeschen" /> Gespeichertes Passwort löschen
					</label>
				{/if}
				<div class="zwei">
					<label class="feld">
						<span>Absender (E-Mail-Adresse)</span>
						<input
							name="from"
							type="email"
							value={wert('from', v.from)}
							placeholder={g.from && !v.from ? `aus .env: ${g.from}` : 'intranet@example.de'}
							aria-invalid={ff.from ? 'true' : undefined}
						/>
						{#if ff.from}<span class="feldfehler">{ff.from}</span>{/if}
					</label>
					<label class="feld">
						<span>Anzeigename <span class="optional">(optional)</span></span>
						<input
							name="fromName"
							maxlength="80"
							value={wert('fromName', v.fromName)}
							placeholder={g.fromName && !v.fromName ? `aus .env: ${g.fromName}` : 'Intranet'}
							aria-invalid={ff.fromName ? 'true' : undefined}
						/>
						{#if ff.fromName}<span class="feldfehler">{ff.fromName}</span>{/if}
					</label>
				</div>
				<label class="feld">
					<span>Antworten an <span class="optional">(optional)</span></span>
					<input
						name="replyTo"
						type="email"
						value={wert('replyTo', v.replyTo)}
						placeholder={g.replyTo && !v.replyTo
							? `aus .env: ${g.replyTo}`
							: 'leer: an den Absender'}
						aria-invalid={ff.replyTo ? 'true' : undefined}
					/>
					{#if ff.replyTo}<span class="feldfehler">{ff.replyTo}</span>{/if}
				</label>
				<label class="option">
					<input type="checkbox" name="insecure" checked={g.insecure} />
					<span>
						Zertifikat nicht prüfen
						<span class="hinweis">
							Nur für einen internen Server mit eigenem Zertifikat. Unsicher.
						</span>
					</span>
				</label>
				<div><button class="knopf" type="submit">Speichern</button></div>
			</form>
			<form
				method="POST"
				action="?/smtpTest"
				use:enhance={() => {
					sende = true;
					return async ({ update }) => {
						await update({ reset: false });
						sende = false;
					};
				}}
			>
				<button class="knopf zweit" type="submit" disabled={sende || !data.mail}>
					{sende ? 'Sende …' : 'Test-E-Mail an mich'}
				</button>
			</form>
			{#if bereich('smtpTest')?.ergebnis}
				<p class="meldung" role="status">{bereich('smtpTest')?.ergebnis}</p>
			{/if}
			{#if bereich('smtpTest')?.fehler}
				<p class="meldung fehler" role="alert">{bereich('smtpTest')?.fehler}</p>
			{/if}
		{/if}
	</section>

	<section class="karte stapel" aria-labelledby="h-teams">
		<h2 id="h-teams">
			Teams
			<Info
				thema="Teams"
				text="Das Intranet läuft als App in Teams, angemeldet wird über das Microsoft-Konto. Benachrichtigungen erscheinen in Teams unter „Aktivität“, für jedes Thema wählbar (voreingestellt wie Push). Ein Klick öffnet den Beitrag in der App. Nur für Personen mit Microsoft-Konto, bei denen die App installiert ist; Ruhezeiten gelten wie bei Push."
			/>
		</h2>
		{#if data.teams}
			{@const t = data.teams}
			{#if bereich('teams')?.ergebnis}
				<p class="meldung" role="status">{bereich('teams')?.ergebnis}</p>
			{/if}
			{#if bereich('teams')?.fehler}
				<p class="meldung fehler" role="alert">{bereich('teams')?.fehler}</p>
			{/if}
			{#if !t.entra}
				<p class="hinweis">Dafür muss zuerst die Anmeldung mit Microsoft eingerichtet sein.</p>
			{:else}
				<form method="POST" action="?/teamsSchalten" use:enhance class="zeile">
					<input type="hidden" name="aktiv" value={t.einstellung.aktiv ? 'nein' : 'ja'} />
					<p>
						Teams-Benachrichtigungen sind <strong>{t.einstellung.aktiv ? 'an' : 'aus'}</strong>.
					</p>
					<button class="knopf {t.einstellung.aktiv ? 'zweit' : ''}" type="submit">
						{t.einstellung.aktiv ? 'Ausschalten' : 'Einschalten'}
					</button>
				</form>
				{#if t.status}
					<p class={['hinweis', !t.status.ok && 'fehlertext']}>
						Letzter Versand {datum.format(new Date(t.status.zeit))}: {t.status.ok
							? `${t.status.gesendet} ${t.status.gesendet === 1 ? 'Person' : 'Personen'} erreicht`
							: t.status.meldung}
					</p>
				{/if}
				<details open={Boolean(bereich('teams-marke'))}>
					<summary>Aussehen der Teams-App</summary>
					{#if bereich('teams-marke')?.ergebnis}
						<p class="meldung" role="status">{bereich('teams-marke')?.ergebnis}</p>
					{/if}
					{#if bereich('teams-marke')?.fehler}
						<p class="meldung fehler" role="alert">{bereich('teams-marke')?.fehler}</p>
					{/if}
					<TeamsAussehen aussehen={t.aussehen} />
				</details>
				<details>
					<summary>Einrichtung</summary>
					<ol class="schritte">
						<li>
							In der App-Registrierung die <strong>
								Anwendungsberechtigung TeamsActivity.Send
							</strong>
							hinzufügen und die Administratorzustimmung erteilen. Prüfen unter Verwaltung → Anmeldung
							→ „Verbindung prüfen“.
						</li>
						<li>
							Unter <strong>Expose an API</strong> die Application ID URI setzen:
							<code>{t.ssoResource ?? 'api://<Host>/<Client-ID>'}</code>. Dort den Scope
							<code>access_as_user</code> anlegen (Admins und Benutzer) und unter „Authorized client
							applications“ beide Teams-Clients mit diesem Scope hinzufügen:
							<code>1fec8e78-bce4-4aaf-ab1b-5451cc387264</code> (Desktop und Handy) und
							<code>5e3ce6c0-2b1f-4285-8d4b-75ee78787346</code> (Browser).
						</li>
						<li>
							Für die delegierten Rechte <strong>User.Read</strong> und
							<strong>GroupMember.Read.All</strong> (die hat die normale Anmeldung schon) die Administratorzustimmung
							erteilen. Damit meldet die App die Leute in Teams ohne Rückfrage an.
						</li>
						<li>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Download, keine Seite -->
							<a href="/verwaltung/benachrichtigungen/teams-app" download>
								App-Paket herunterladen
							</a>
							(Version 1.0.{t.einstellung.version}) und im Teams Admin Center unter „Apps verwalten“
							hochladen.
						</li>
						<li>
							Die App per <strong>Setup-Richtlinie</strong> für alle (oder die Intranet-Gruppe) installieren.
							Erst dann kommen Meldungen bei den Personen an.
						</li>
					</ol>
					<p class="hinweis">
						App-ID im Manifest: <code>{t.einstellung.appId}</code>. Ändert sich die Adresse des
						Intranets oder die App-Registrierung, erzeuge eine neue Version und aktualisiere die
						App.
					</p>
					<form method="POST" action="?/teamsVersion" use:enhance>
						<button class="knopf zweit" type="submit">Neue Version erzeugen</button>
					</form>
				</details>
				<form method="POST" action="?/teamsTest" use:enhance>
					<button
						class="knopf zweit"
						type="submit"
						disabled={!t.microsoftKonto}
						title={t.microsoftKonto ? undefined : 'Nur mit einem Microsoft-Konto'}
					>
						Testmeldung an mich
					</button>
				</form>
				{#if !t.microsoftKonto}
					<p class="hinweis">
						Die Testmeldung geht nur, wenn du mit einem Microsoft-Konto angemeldet bist.
					</p>
				{/if}
			{/if}
		{:else}
			<p class="hinweis">Teams richten System-Admins ein.</p>
		{/if}
	</section>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	p {
		margin: 0;
	}
	.daten {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
		gap: 12px 20px;
		margin: 0;
	}
	dt {
		font-size: 13px;
		color: var(--mu);
	}
	dd {
		margin: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.knopf {
		justify-self: start;
	}
	.zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.schritte {
		margin: 8px 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 6px;
	}
	.fehlertext {
		color: var(--err-tx);
	}
	.zwei {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 12px;
	}
	@media (max-width: 560px) {
		.zwei {
			grid-template-columns: 1fr;
		}
	}
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.reihe {
		display: grid;
		gap: 0;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
	}
	.option input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--fill);
	}
	.zwei.gleich {
		grid-template-columns: 1fr 1fr;
	}
</style>
