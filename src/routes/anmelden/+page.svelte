<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Anmelden · Intranet</title>
</svelte:head>

<section class="anmelden" aria-labelledby="titel">
	<h1 id="titel">Anmelden</h1>

	{#if data.fehler}
		<p class="meldung fehler" role="alert">{data.fehler}</p>
	{:else if data.abgemeldet}
		<p class="meldung" role="status">Du bist abgemeldet.</p>
	{/if}

	{#if data.entraAktiv}
		<form method="GET" action="/anmelden/entra" data-sveltekit-reload>
			{#if data.ziel !== '/'}<input type="hidden" name="ziel" value={data.ziel} />{/if}
			<button class="knopf" type="submit">Mit Microsoft anmelden</button>
		</form>
		<p class="hinweis">Mit deinem Firmenkonto. Die Zwei-Faktor-Prüfung erledigt Microsoft.</p>
	{:else}
		<p class="hinweis">Die Anmeldung mit Microsoft ist noch nicht eingerichtet.</p>
	{/if}
</section>

<style>
	.anmelden {
		max-width: 26rem;
		margin: 4rem auto;
		padding: 0 1rem;
	}
	.knopf {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 999px;
		background: var(--akzent, #1f4f8f);
		color: #fff;
		font-weight: 600;
		border: 0;
		font: inherit;
		cursor: pointer;
	}
	.knopf:focus-visible {
		outline: 3px solid currentColor;
		outline-offset: 3px;
	}
	.meldung {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #eef3fb;
		color: #10233f;
	}
	.meldung.fehler {
		background: #fdecec;
		color: #6b1010;
	}
	.hinweis {
		color: inherit;
		opacity: 0.85;
	}
</style>
