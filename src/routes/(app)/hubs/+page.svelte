<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import HubGlocke from '#lib/components/HubGlocke.svelte';
	import { actionUrl } from '#lib/action-url.ts';

	let { data, form } = $props();
</script>

<svelte:head><title>Hubs · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Hubs</h1>
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
		<div class="aktionen">
			{#if data.antraegePruefen}
				<a class="knopf zweit" href={resolve('/(app)/hubs/antraege')}>Anträge prüfen</a>
			{/if}
			<a class="knopf zweit" href={resolve('/(app)/hubs/beantragen')}>Hub beantragen</a>
		</div>
	</div>
	<p class="hinweis">
		Themenseiten über Abteilungen hinweg. Tipp auf die Glocke, dann erscheinen die Beiträge eines
		Hubs unter „Aus den Hubs“.
	</p>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}
	{#if data.offeneAntraege}
		<p class="meldung" role="status">
			Dein Antrag wird geprüft. Rückfragen kommen als <a href={resolve('/(app)/nachrichten')}>
				Nachricht
			</a>.
		</p>
	{/if}

	<nav class="pillen" aria-label="Ansicht">
		<a class="pille" href="?" aria-current={!data.meine ? 'true' : undefined}>Alle Hubs</a>
		<a class="pille" href="?ansicht=meine" aria-current={data.meine ? 'true' : undefined}>
			Meine Abos
		</a>
	</nav>

	{#if data.hubs.length === 0}
		<p class="karte hinweis">
			{data.meine
				? 'Du hast noch keine Hubs abonniert.'
				: 'Es gibt noch keine Hubs. Beantrag doch den ersten!'}
		</p>
	{:else}
		<ul class="raster">
			{#each data.hubs as h (h.id)}
				<li class="karte hub">
					<div class="oben">
						<a class="name dehnen" href={resolve('/(app)/hubs/[slug]', { slug: h.slug })}>
							{h.name}
						</a>
						<span class="glocke"><HubGlocke hub={h} /></span>
					</div>
					{#if h.about}<p class="text">
							{h.about.slice(0, 120)}{h.about.length > 120 ? ' …' : ''}
						</p>{/if}
					<div class="schilder">
						{#if h.isCentral}<span class="schild">Alle Mandanten</span>{:else}<span class="schild">
								{h.tenantShort}
							</span>{/if}
						{#if h.resting}<span class="schild warn">Ruht</span>{/if}
						{#if h.mandatory}<span class="schild rand">
								Pflicht-Abo
							</span>{:else if h.subscribed}<span class="schild rand"> Abonniert </span>{/if}
					</div>
				</li>
			{/each}
		</ul>
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
	.aktionen,
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.raster {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
		gap: 12px;
	}
	.hub {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		transition: box-shadow 0.15s ease;
	}
	.hub:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
	}
	.hub:has(.dehnen:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.oben {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 10px;
	}
	.name {
		font-size: 16px;
		font-weight: 700;
		color: var(--tx);
		text-decoration: none;
	}
	.dehnen:focus-visible {
		outline: none;
	}
	.dehnen::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.glocke {
		position: relative;
		z-index: 1;
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: auto;
	}
	.schild.warn {
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.text {
		margin: 0;
		font-size: 14px;
		color: var(--mu);
	}
</style>
