<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Dateilinks unter /dateien (Endpunkt ohne Seitenroute) */
	import { resolve } from '$app/paths';
	import { formatIsoDate, formatSize } from '#lib/format.ts';
	import { AGREEMENT_KINDS } from '#lib/legal.ts';

	let { data } = $props();
	const v = $derived(data.v);
	const art = $derived(AGREEMENT_KINDS.find((k) => k.key === v.kind)?.single ?? '');
</script>

<svelte:head><title>{v.title} · Rechtliches · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/rechtliches')}>← Rechtliches</a>
	<div class="kopfzeile">
		<div>
			<p class="art">{art}</p>
			<h1>{v.title}</h1>
		</div>
		{#if v.canWrite}
			<a class="knopf zweit" href={resolve('/(app)/rechtliches/[id]/bearbeiten', { id: v.id })}>
				Bearbeiten
			</a>
		{/if}
	</div>
	<dl class="daten">
		<div>
			<dt>Stand</dt>
			<dd>{formatIsoDate(v.versionDate)}</dd>
		</div>
		<div>
			<dt>Gilt ab</dt>
			<dd>{formatIsoDate(v.validFrom)}</dd>
		</div>
	</dl>
	{#if v.description}<p class="text">{v.description}</p>{/if}
	<section class="karte" aria-labelledby="h-dok">
		<h2 id="h-dok">Dokumente</h2>
		<ul class="dateien">
			{#each v.attachments as a (a.id)}
				<li>
					<a href="/dateien/{a.id}" target="_blank" rel="noopener">{a.name}</a>
					<span class="hinweis">{formatSize(a.size)}</span>
					<a class="klein" href="/dateien/{a.id}?download">Herunterladen</a>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.seite {
		max-width: 48rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.art {
		margin: 0;
		color: var(--mu);
		font-weight: 600;
		font-size: 14px;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: 8px;
	}
	.daten {
		display: flex;
		gap: 32px;
		margin: 0;
	}
	dt {
		font-size: 13px;
		color: var(--mu);
	}
	dd {
		margin: 0;
		font-weight: 600;
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.dateien {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.dateien li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		align-items: baseline;
	}
	.klein {
		font-size: 14px;
	}
</style>
