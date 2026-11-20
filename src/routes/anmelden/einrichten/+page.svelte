<script lang="ts">
	import { startRegistration } from '@simplewebauthn/browser';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let passkeyCodes = $state<string[] | null>(null);
	let passkeyFehler = $state('');
	let passkeyName = $state('');
	let laeuft = $state(false);

	const codes = $derived(passkeyCodes ?? form?.codes ?? null);

	async function passkeyEinrichten() {
		passkeyFehler = '';
		laeuft = true;
		try {
			const optRes = await fetch('/anmelden/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'registrieren-optionen' })
			});
			if (!optRes.ok) throw new Error();
			const antwort = await startRegistration({ optionsJSON: await optRes.json() });
			const res = await fetch('/anmelden/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'registrieren', antwort, name: passkeyName })
			});
			const ergebnis = await res.json();
			if (!ergebnis.ok) throw new Error();
			passkeyCodes = ergebnis.codes;
		} catch {
			passkeyFehler = 'Der Passkey konnte nicht eingerichtet werden. Versuch es noch einmal.';
		} finally {
			laeuft = false;
		}
	}

	function kopieren() {
		if (codes) void navigator.clipboard?.writeText(codes.join('\n'));
	}
</script>

<svelte:head>
	<title>Zweiten Faktor einrichten · Intranet</title>
</svelte:head>

<section class="karte" aria-labelledby="titel">
	{#if codes}
		<h1 id="titel">Deine Wiederherstellungscodes</h1>
		<p>
			Mit diesen Codes kommst du rein, wenn du dein Handy oder deinen Passkey nicht zur Hand hast.
			Jeder Code gilt einmal. <strong>
				Bewahr sie sicher auf, z. B. in deinem Passwortmanager.
			</strong>
			Du siehst sie nur jetzt.
		</p>
		<ol class="codes">
			{#each codes as code (code)}<li><code>{code}</code></li>{/each}
		</ol>
		<button class="link" type="button" onclick={kopieren}>Codes kopieren</button>
		<form method="POST" action="?/fertig">
			<button class="knopf" type="submit">Ich habe die Codes gesichert</button>
		</form>
	{:else if data.fertig}
		<h1 id="titel">Fast geschafft</h1>
		<form method="POST" action="?/fertig">
			<button class="knopf" type="submit">Weiter ins Intranet</button>
		</form>
	{:else}
		<h1 id="titel">Zweiten Faktor einrichten</h1>
		<p>
			Hallo {data.name}, zum Schutz deines Kontos brauchst du einen zweiten Faktor. Wähle eine der
			beiden Möglichkeiten.
		</p>

		<h2>Authenticator-App</h2>
		{#if form?.totp || form?.totpOffen}
			{#if form?.totp}
				<p>Scanne den QR-Code mit deiner App (z. B. Microsoft Authenticator).</p>
				<div class="qr" role="img" aria-label="QR-Code zum Einrichten der Authenticator-App">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- serverseitig erzeugtes SVG -->
					{@html form.totp.qr}
				</div>
				<p>Oder gib diesen Schlüssel von Hand ein: <code>{form.totp.schluessel}</code></p>
			{/if}
			<form method="POST" action="?/totpBestaetigen" class="felder" use:enhance>
				{#if form?.totpFehler}<p class="meldung fehler" role="alert">{form.totpFehler}</p>{/if}
				<label>
					Code aus der App
					<input
						name="code"
						inputmode="numeric"
						autocomplete="one-time-code"
						maxlength="7"
						required
					/>
				</label>
				<button class="knopf" type="submit">Bestätigen</button>
			</form>
			{#if !form?.totp}
				<form method="POST" action="?/totpStarten" use:enhance>
					<button class="link" type="submit">QR-Code neu anzeigen</button>
				</form>
			{/if}
		{:else}
			<form method="POST" action="?/totpStarten" use:enhance>
				<button class="knopf" type="submit">App einrichten</button>
			</form>
		{/if}

		<h2>Passkey</h2>
		<p>Mit Fingerabdruck, Gesicht oder Geräte-PIN – ohne Code abzutippen.</p>
		<label class="felder">
			Name für den Passkey (optional)
			<input bind:value={passkeyName} maxlength="60" placeholder="z. B. Mein Laptop" />
		</label>
		<button class="knopf" type="button" onclick={passkeyEinrichten} disabled={laeuft}>
			Passkey einrichten
		</button>
		{#if passkeyFehler}<p class="meldung fehler" role="alert">{passkeyFehler}</p>{/if}
	{/if}
</section>

<style>
	.karte {
		max-width: 32rem;
		margin: 3rem auto;
		padding: 0 1rem;
		display: grid;
		gap: 0.75rem;
	}
	h2 {
		margin: 1.25rem 0 0;
		font-size: 1.15rem;
	}
	.felder {
		display: grid;
		gap: 0.5rem;
		font-weight: 600;
	}
	label {
		display: grid;
		gap: 0.25rem;
	}
	input {
		min-height: 44px;
		padding: 0 0.75rem;
		font: inherit;
		border: 1px solid #767676;
		border-radius: 0.5rem;
	}
	.qr {
		width: 12rem;
		background: #fff;
		padding: 0.5rem;
	}
	.codes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem 1.5rem;
		font-size: 1.05rem;
	}
	.knopf {
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 999px;
		background: var(--akzent, #1f4f8f);
		color: #fff;
		font: inherit;
		font-weight: 600;
		border: 0;
		cursor: pointer;
		justify-self: start;
	}
	.link {
		min-height: 44px;
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: #1f4f8f;
		text-decoration: underline;
		cursor: pointer;
		justify-self: start;
	}
	:focus-visible {
		outline: 3px solid #1f4f8f;
		outline-offset: 2px;
	}
	.meldung.fehler {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #fdecec;
		color: #6b1010;
	}
</style>
