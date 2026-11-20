<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
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
</script>

<svelte:head><title>Benachrichtigungen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung')}>← Verwaltung</a>
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
		<h2 id="h-teams">Teams</h2>
		<p class="hinweis">Folgt mit der Intranet-App im Tenant.</p>
	</section>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
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
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
