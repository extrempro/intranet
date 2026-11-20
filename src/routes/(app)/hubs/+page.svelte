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
			<a class="knopf" href={resolve('/(app)/hubs/beantragen')}>Hub beantragen</a>
		</div>
	</div>
	<p class="hinweis">
		Themengruppen zum Mitmachen. Tipp auf die Glocke, dann erscheinen die Beiträge eines Hubs unter
		„Aus den Hubs“.
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
						<a class="name" href={resolve('/(app)/hubs/[slug]', { slug: h.slug })}>{h.name}</a>
						<HubGlocke hub={h} />
					</div>
					<div class="schilder">
						{#if h.isCentral}<span class="schild rand">Für alle Mandanten</span>{:else}<span
								class="schild rand"
							>
								{h.tenantShort}
							</span>{/if}
						{#if h.resting}<span class="schild warn">ruht</span>{/if}
						{#if h.mandatory}<span class="schild">Pflicht-Abo</span>{/if}
					</div>
					{#if h.about}<p class="text">
							{h.about.slice(0, 180)}{h.about.length > 180 ? ' …' : ''}
						</p>{/if}
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
	.pille {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		text-decoration: none;
		font-weight: 600;
	}
	.pille[aria-current='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.raster {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.hub {
		display: grid;
		gap: 8px;
		align-content: start;
	}
	.oben {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 10px;
	}
	.name {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--tx);
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.schild.warn {
		background: #fef0c7;
		color: #7a2e0e;
	}
	.text {
		margin: 0;
		color: var(--mu);
	}
</style>
