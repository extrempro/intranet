<script lang="ts">
	let { data, form } = $props();
	let lokalOffen = $derived(!data.entraAktiv || !!form?.lokalFehler);
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
	</form>
{:else}
	<button class="knopf zweit breit" type="button" onclick={() => (lokalOffen = true)}>
		Ohne Microsoft-Konto anmelden
	</button>
{/if}

<style>
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
