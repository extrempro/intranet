<script lang="ts">
	/**
	 * Erneute Anmeldung: lokal mit Code (App oder Wiederherstellungscode) oder
	 * Passkey, Microsoft-Konten mit einer neuen Microsoft-Anmeldung. In der
	 * Teams-App geht das nicht, dort nur ein Link in den Browser.
	 */
	import { startAuthentication } from '@simplewebauthn/browser';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { BestaetigungsWege } from '#lib/bestaetigung.ts';

	let {
		wege,
		ziel,
		dialog = false,
		fehler = '',
		onbestaetigt,
		onmicrosoft
	}: {
		wege: BestaetigungsWege;
		/** Wohin nach der Bestätigung (Seite ohne Dialog) */
		ziel: string;
		/** Im Dialog: Ergebnis per Rückruf statt Seitenwechsel */
		dialog?: boolean;
		fehler?: string;
		onbestaetigt?: (bis: string) => void;
		/** Im Dialog: Microsoft-Anmeldung im eigenen Fenster öffnen */
		onmicrosoft?: (href: string) => boolean;
	} = $props();

	let codeFehler = $state('');
	let passkeyFehler = $state('');
	let laeuft = $state(false);

	const microsoftHref = $derived(
		`/anmelden/entra?bestaetigen=1&ziel=${encodeURIComponent(dialog ? '/bestaetigen/fertig' : ziel)}`
	);

	async function mitPasskey() {
		passkeyFehler = '';
		laeuft = true;
		try {
			const opt = await fetch('/bestaetigen/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'optionen' })
			});
			if (!opt.ok) throw new Error();
			const antwort = await startAuthentication({ optionsJSON: await opt.json() });
			const res = await fetch('/bestaetigen/passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ aktion: 'pruefen', antwort })
			});
			const r = await res.json();
			if (res.status === 429) {
				passkeyFehler = `Zu viele Fehlversuche. Warte bitte ${r.warten} Sekunden.`;
				return;
			}
			if (!r.ok) throw new Error();
			onbestaetigt?.(r.bis);
		} catch {
			passkeyFehler = 'Die Bestätigung mit dem Passkey hat nicht geklappt. Versuch es noch einmal.';
		} finally {
			laeuft = false;
		}
	}

	function microsoft(e: MouseEvent) {
		if (onmicrosoft?.(microsoftHref)) e.preventDefault();
	}
</script>

<div class="bestaetigen">
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}

	{#if wege.teams}
		<p>
			In der Teams-App kannst du dich nicht erneut anmelden. Öffne das Intranet im Browser, um diese
			Einstellung zu ändern.
		</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- geprüfter eigener Pfad, in neuem Fenster -->
		<a class="knopf" href={page.url.origin + ziel} target="_blank" rel="noopener">
			Im Browser öffnen
		</a>
	{:else if wege.art === 'entra'}
		<p>
			Melde dich noch einmal mit deinem Microsoft-Konto an. Danach kannst du 10 Minuten lang ändern.
		</p>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Microsoft-Anmeldung (Server-Endpunkt) -->
		<a class="knopf" href={microsoftHref} onclick={microsoft}>Mit Microsoft bestätigen</a>
	{:else}
		<p>Bestätige mit deinem zweiten Faktor. Danach kannst du 10 Minuten lang ändern.</p>
		{#if wege.passkey}
			<button class="knopf zweit" type="button" onclick={mitPasskey} disabled={laeuft}>
				Mit Passkey bestätigen
			</button>
			{#if passkeyFehler}<p class="meldung fehler" role="alert">{passkeyFehler}</p>{/if}
		{/if}
		<form
			method="POST"
			action="/bestaetigen?/code"
			class="felder"
			use:enhance={() => {
				codeFehler = '';
				return async ({ result, update }) => {
					if (result.type === 'success' && dialog) {
						onbestaetigt?.(String(result.data?.bis ?? ''));
					} else if (result.type === 'failure') {
						codeFehler = String(result.data?.codeFehler ?? 'Das hat nicht geklappt.');
					} else if (!dialog) {
						await update();
					}
				};
			}}
		>
			<input type="hidden" name="ziel" value={ziel} />
			{#if dialog}<input type="hidden" name="dialog" value="1" />{/if}
			<label class="feld">
				<span>
					{wege.totp
						? 'Code aus deiner Authenticator-App oder Wiederherstellungscode'
						: 'Wiederherstellungscode'}
				</span>
				<input name="code" autocomplete="one-time-code" maxlength="20" required />
			</label>
			{#if codeFehler}<p class="meldung fehler" role="alert">{codeFehler}</p>{/if}
			<button class="knopf" type="submit">Bestätigen</button>
		</form>
	{/if}
</div>

<style>
	.bestaetigen {
		display: grid;
		gap: 12px;
		justify-items: start;
	}
	.bestaetigen p {
		margin: 0;
	}
	.bestaetigen form {
		width: 100%;
	}
</style>
