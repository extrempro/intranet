<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();
	const sicherheit = $derived(page.url.pathname.startsWith('/betreiber/sicherheit'));
</script>

<div class="flaeche akzent" style={data.akzent}>
	<a class="skip" href="#inhalt">Zum Inhalt springen</a>
	<header class="kopf">
		<div class="logo" aria-hidden="true">{data.marke.kurz}</div>
		<div class="titel">
			<strong>Kantinen-Pflege</strong>
			<span class="hinweis">{data.standort}</span>
		</div>
		<span class="hinweis wer">{data.ich}</span>
		<nav class="links" aria-label="Konto">
			{#if sicherheit}
				<a class="knopf zweit rund" href={resolve('/(betreiber)/betreiber')}>Speiseplan</a>
			{:else}
				<a class="knopf zweit rund" href={resolve('/(betreiber)/betreiber/sicherheit')}>
					Sicherheit
				</a>
			{/if}
			<form method="POST" action="/abmelden">
				<button class="knopf zweit rund" type="submit">Abmelden</button>
			</form>
		</nav>
	</header>
	<main id="inhalt" class="inhalt">
		{#if !data.aktiv}
			<p class="meldung fehler" role="alert">
				Dieser Standort ist deaktiviert. Wende dich bitte an die Verwaltung.
			</p>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>

<style>
	.flaeche {
		min-height: 100vh;
		background: var(--bg);
		color: var(--tx);
		display: flex;
		flex-direction: column;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		background: var(--sf);
		border-bottom: 1px solid var(--bd);
	}
	.logo {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--fill);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 13px;
	}
	.titel {
		display: flex;
		flex-direction: column;
		flex: 1 1 200px;
	}
	.links {
		display: flex;
		gap: 8px;
	}
	.rund {
		border-radius: 999px;
		min-height: 40px;
	}
	.inhalt {
		flex: 1;
		box-sizing: border-box;
		width: 100%;
		max-width: 892px;
		margin: 0 auto;
		padding: 24px 16px;
	}
</style>
