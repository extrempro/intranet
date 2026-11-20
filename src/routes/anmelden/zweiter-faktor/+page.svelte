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

<section class="karte" aria-labelledby="titel">
	<h1 id="titel">Bestätige deine Anmeldung</h1>

	{#if data.hatPasskey}
		<button class="knopf" type="button" onclick={mitPasskey} disabled={laeuft}>
			Mit Passkey bestätigen
		</button>
		{#if passkeyFehler}<p class="meldung fehler" role="alert">{passkeyFehler}</p>{/if}
	{/if}

	<form method="POST" class="felder">
		<input type="hidden" name="art" value={art} />
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		{#if art === 'totp'}
			<label>
				Code aus deiner Authenticator-App
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
			<label>
				Wiederherstellungscode
				<input name="code" autocomplete="off" autocapitalize="characters" required />
			</label>
		{/if}
		<button class="knopf zweit" type="submit">Bestätigen</button>
	</form>

	{#if data.hatTotp}
		<button
			class="link"
			type="button"
			onclick={() => (art = art === 'totp' ? 'wiederherstellung' : 'totp')}
		>
			{art === 'totp'
				? 'Kein Zugriff auf die App? Wiederherstellungscode nutzen'
				: 'Code aus der App nutzen'}
		</button>
	{/if}
</section>

<style>
	.karte {
		max-width: 26rem;
		margin: 4rem auto;
		padding: 0 1rem;
		display: grid;
		gap: 1rem;
	}
	.felder {
		display: grid;
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
	}
	input {
		min-height: 44px;
		padding: 0 0.75rem;
		font: inherit;
		border: 1px solid #767676;
		border-radius: 0.5rem;
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
		text-align: left;
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
