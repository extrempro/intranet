<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
	import { onMount } from 'svelte';

	let { data, form } = $props();
	let lokalOffen = $derived(!data.entraAktiv || !!form?.lokalFehler);
	let passkeyMoeglich = $state(false);
	let passkeyLaeuft = $state(false);
	let passkeyFehler = $state('');
	onMount(() => (passkeyMoeglich = browserSupportsWebAuthn()));

	/** Anmeldung nur mit Passkey (Gerätesperre per PIN oder Biometrie). */
	async function mitPasskey() {
		passkeyFehler = '';
		passkeyLaeuft = true;
		try {
			const opt = await fetch('/anmelden/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'direkt-optionen' })
			});
			if (opt.status === 429) {
				passkeyFehler = 'Zu viele Anmeldeversuche. Warte bitte kurz.';
				return;
			}
			if (!opt.ok) throw new Error();
			const antwort = await startAuthentication({ optionsJSON: await opt.json() });
			const res = await fetch('/anmelden/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'direkt', antwort, ziel: data.ziel })
			});
			const ergebnis = await res.json().catch(() => ({ ok: false }));
			if (res.status === 429 && ergebnis.warten) {
				passkeyFehler = `Zu viele Fehlversuche. Warte bitte ${ergebnis.warten} Sekunden.`;
				return;
			}
			if (!ergebnis.ok) throw new Error();
			// Ziel kommt vom Server und ist dort auf relative Pfade geprüft
			await goto(ergebnis.ziel, { invalidateAll: true });
		} catch {
			passkeyFehler =
				'Die Anmeldung mit dem Passkey hat nicht geklappt. Nutze sonst E-Mail und Passwort.';
		} finally {
			passkeyLaeuft = false;
		}
	}
	const entraHref = $derived(
		data.ziel === '/' ? '/anmelden/entra' : `/anmelden/entra?ziel=${encodeURIComponent(data.ziel)}`
	);
</script>

<svelte:head>
	<title>Anmelden · Intranet</title>
</svelte:head>

<h1>Anmelden</h1>

{#if data.fehler}
	<p class="meldung fehler" role="alert">{data.fehler}</p>
{:else if data.passwortGeaendert}
	<p class="meldung" role="status">
		Dein Passwort ist geändert. Melde dich jetzt mit dem neuen Passwort an.
	</p>
{:else if data.abgemeldet}
	<p class="meldung" role="status">Du bist abgemeldet.</p>
{/if}

{#if data.entraAktiv}
	<!--
		Bewusst ein Link, kein Formular: Die CSP „form-action 'self'“ würde in Chrome
		die Weiterleitung eines Formulars zu login.microsoftonline.com blockieren.
	-->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Ziel ist eine eigene Route mit geprüftem Rücksprung -->
	<a class="knopf dunkel breit" href={entraHref} data-sveltekit-reload>
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
			<rect x="2" y="2" width="9" height="9" fill="#F25022" /><rect
				x="13"
				y="2"
				width="9"
				height="9"
				fill="#7FBA00"
			/><rect x="2" y="13" width="9" height="9" fill="#00A4EF" /><rect
				x="13"
				y="13"
				width="9"
				height="9"
				fill="#FFB900"
			/>
		</svg>
		Mit Microsoft anmelden
	</a>
	<p class="hinweis">Mit deinem Firmenkonto. Die Zwei-Faktor-Prüfung erledigt Microsoft.</p>
	<div class="trenner"><span></span>oder lokales Konto<span></span></div>
{/if}

{#if lokalOffen}
	<form method="POST" action="?/lokal" class="felder">
		<input type="hidden" name="ziel" value={data.ziel} />
		{#if form?.lokalFehler}<p class="meldung fehler" role="alert">{form.lokalFehler}</p>{/if}
		<label class="feld">
			<span>E-Mail-Adresse</span>
			<input name="email" type="email" autocomplete="username" required value={form?.email ?? ''} />
		</label>
		<label class="feld">
			<span>Passwort</span>
			<input name="passwort" type="password" autocomplete="current-password" required />
		</label>
		<button class="knopf breit" type="submit">Weiter</button>
		{#if passkeyMoeglich}
			<button class="knopf zweit breit" type="button" onclick={mitPasskey} disabled={passkeyLaeuft}>
				Mit Passkey anmelden
			</button>
			{#if passkeyFehler}<p class="meldung fehler" role="alert">{passkeyFehler}</p>{/if}
		{/if}
		<a class="vergessen" href={resolve('/(auth)/anmelden/passwort-vergessen')}>
			Passwort vergessen?
		</a>
	</form>
{:else}
	<button class="knopf zweit breit" type="button" onclick={() => (lokalOffen = true)}>
		Ohne Microsoft-Konto anmelden
	</button>
{/if}

<style>
	.vergessen {
		align-self: center;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		font-size: 24px;
		margin: 0;
	}
	.breit {
		width: 100%;
		min-height: 48px;
	}
	.trenner {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--mu);
		font-size: 13px;
	}
	.trenner span {
		flex: 1;
		height: 1px;
		background: var(--bd);
	}
</style>
