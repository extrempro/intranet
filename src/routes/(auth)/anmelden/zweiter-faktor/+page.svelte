<script lang="ts">
	import { startAuthentication } from '@simplewebauthn/browser';
	import { goto } from '$app/navigation';

	let { data, form } = $props();

	let art = $derived<'totp' | 'wiederherstellung'>(
		form?.art === 'recovery' || !data.hatTotp ? 'wiederherstellung' : 'totp'
	);
	let passkeyFehler = $state('');
	let laeuft = $state(false);

	async function mitPasskey() {
		passkeyFehler = '';
		laeuft = true;
		try {
			const optRes = await fetch('/anmelden/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'anmelden-optionen' })
			});
			if (optRes.status === 429) {
				const { warten } = await optRes.json();
				passkeyFehler = `Zu viele Fehlversuche. Warte bitte ${warten} Sekunden.`;
				return;
			}
			if (!optRes.ok) throw new Error();
			const antwort = await startAuthentication({ optionsJSON: await optRes.json() });
			const res = await fetch('/anmelden/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'anmelden', antwort })
			});
			const ergebnis = await res.json();
			if (!ergebnis.ok) throw new Error();
			// Ziel kommt vom Server und ist dort auf relative Pfade geprüft
			await goto(ergebnis.ziel, { invalidateAll: true });
		} catch {
			passkeyFehler = 'Die Anmeldung mit dem Passkey hat nicht geklappt. Versuch es noch einmal.';
		} finally {
			laeuft = false;
		}
	}
</script>

<svelte:head>
	<title>Zweiter Faktor · Intranet</title>
</svelte:head>

<div class="stapel">
	<h1>Bestätigung</h1>

	{#if data.hatPasskey}
		<button class="knopf zweit" type="button" onclick={mitPasskey} disabled={laeuft}>
			Mit Passkey bestätigen
		</button>
		{#if passkeyFehler}<p class="meldung fehler" role="alert">{passkeyFehler}</p>{/if}
	{/if}

	<form method="POST" class="felder">
		<input type="hidden" name="art" value={art} />
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		{#if art === 'totp'}
			<label class="feld">
				<span>Code aus deiner Authenticator-App</span>
				<input
					name="code"
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern="[0-9 ]*"
					maxlength="7"
					required
				/>
			</label>
		{:else}
			<label class="feld">
				<span>Wiederherstellungscode</span>
				<input name="code" autocomplete="off" autocapitalize="characters" required />
			</label>
		{/if}
		<button class="knopf" type="submit">Bestätigen</button>
	</form>

	{#if data.hatTotp}
		<button
			class="linkknopf"
			type="button"
			onclick={() => (art = art === 'totp' ? 'wiederherstellung' : 'totp')}
		>
			{art === 'totp'
				? 'Kein Zugriff auf die App? Wiederherstellungscode nutzen'
				: 'Code aus der App nutzen'}
		</button>
	{/if}
</div>
