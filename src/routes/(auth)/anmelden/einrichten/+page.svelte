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

<div class="stapel">
	{#if codes}
		<h1>Deine Wiederherstellungscodes</h1>
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
		<button class="linkknopf" type="button" onclick={kopieren}>Codes kopieren</button>
		<form method="POST" action="?/fertig">
			<button class="knopf" type="submit">Ich habe die Codes gesichert</button>
		</form>
	{:else if data.fertig}
		<h1>Fast geschafft</h1>
		<form method="POST" action="?/fertig">
			<button class="knopf" type="submit">Weiter ins Intranet</button>
		</form>
	{:else}
		<h1>Zweiten Faktor einrichten</h1>
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
				<label class="feld">
					<span>Code aus der App</span>
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
					<button class="linkknopf" type="submit">QR-Code neu anzeigen</button>
				</form>
			{/if}
		{:else}
			<form method="POST" action="?/totpStarten" use:enhance>
				<button class="knopf" type="submit">App einrichten</button>
			</form>
		{/if}

		<h2>Passkey</h2>
		<p>Mit Fingerabdruck, Gesicht oder Geräte-PIN – ohne Code abzutippen.</p>
		<label class="feld">
			<span>Name für den Passkey (optional)</span>
			<input bind:value={passkeyName} maxlength="60" placeholder="z. B. Mein Laptop" />
		</label>
		<button class="knopf" type="button" onclick={passkeyEinrichten} disabled={laeuft}>
			Passkey einrichten
		</button>
		{#if passkeyFehler}<p class="meldung fehler" role="alert">{passkeyFehler}</p>{/if}
	{/if}
</div>
