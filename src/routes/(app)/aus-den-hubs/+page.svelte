<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Beitragskarte from '#lib/components/Beitragskarte.svelte';
	import { actionUrl } from '#lib/action-url.ts';

	let { data, form } = $props();
</script>

<svelte:head><title>Aus den Hubs · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Aus den Hubs</h1>
			<form method="POST" action={actionUrl(page.url.search, 'favorit')} use:enhance>
				<button
					class="stern"
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
				>
					{data.favorit ? '★' : '☆'}
				</button>
			</form>
		</div>
		<a class="knopf zweit" href={resolve('/(app)/konto/hubs')}>Meine Hubs</a>
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<nav class="pillen" aria-label="Ansicht">
		<a class="pille" href="?" aria-current={!data.alle ? 'true' : undefined}>Meine Abos</a>
		<a class="pille" href="?ansicht=alle" aria-current={data.alle ? 'true' : undefined}>
			Alle Hubs
		</a>
	</nav>

	{#if !data.alle && data.keineAbos}
		<div class="karte stapel leer">
			<strong>Noch keine Hubs abonniert</strong>
			<span class="hinweis">
				Tipp bei einem Hub auf die Glocke. Dann erscheinen hier seine Beiträge.
			</span>
			<a class="knopf" href={resolve('/(app)/hubs')}>Hubs ansehen</a>
		</div>
	{:else if data.items.length === 0}
		<p class="karte hinweis">Noch keine Beiträge.</p>
	{:else}
		{#each data.items as item (item.id)}<Beitragskarte {item} mitReaktionen={false} />{/each}
	{/if}
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	h1 {
		margin: 0;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
	}
	.pillen {
		display: flex;
		gap: 8px;
	}
	.leer {
		justify-items: start;
	}
</style>
