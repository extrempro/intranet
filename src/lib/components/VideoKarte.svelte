<script lang="ts">
	/** Kachel eines Videos (Mediathek, Seiten der Einheiten). */
	import { resolve } from '$app/paths';
	import { STATUS_TEXT, zeitText } from '#lib/mediathek.ts';

	let {
		v,
		einheitZeigen = true
	}: {
		v: {
			id: string;
			title: string;
			unitName: string;
			status: string;
			progress: number;
			durationSec: number;
			topics: { id: string; name: string }[];
		};
		einheitZeigen?: boolean;
	} = $props();
	let ohneBild = $state(false);
	const fertig = $derived(['entwurf', 'veroeffentlicht'].includes(v.status));
	const ziel = $derived(
		v.status === 'veroeffentlicht'
			? resolve('/(app)/mediathek/[id]', { id: v.id })
			: resolve('/(app)/mediathek/[id]/bearbeiten', { id: v.id })
	);
</script>

<article class="karte videokarte">
	<div class="bild" aria-hidden="true">
		{#if fertig && !ohneBild}
			<img
				src="/mediathek/{v.id}/medien/vorschau.jpg"
				alt=""
				loading="lazy"
				onerror={() => (ohneBild = true)}
			/>
		{/if}
		{#if v.durationSec}<span class="dauer">{zeitText(v.durationSec)}</span>{/if}
		{#if v.status !== 'veroeffentlicht'}
			<span class="status">
				{STATUS_TEXT[v.status] ?? v.status}{v.status === 'umwandeln' ? ` · ${v.progress} %` : ''}
			</span>
		{/if}
	</div>
	<div class="text">
		<h3><a href={ziel} class="titel">{v.title}</a></h3>
		{#if einheitZeigen}<span class="hinweis">{v.unitName}</span>{/if}
		{#if v.topics.length}
			<span class="themen">
				{#each v.topics as t (t.id)}<span class="thema">{t.name}</span>{/each}
			</span>
		{/if}
	</div>
</article>

<style>
	.videokarte {
		position: relative;
		padding: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		height: 100%;
	}
	.videokarte:has(.titel:focus-visible) {
		outline: 3px solid var(--fokus, #2f7de1);
		outline-offset: 2px;
	}
	.bild {
		position: relative;
		aspect-ratio: 16 / 9;
		background: var(--tint);
	}
	.bild img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.dauer,
	.status {
		position: absolute;
		padding: 2px 8px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
	}
	.dauer {
		right: 8px;
		bottom: 8px;
		background: rgb(0 0 0 / 0.75);
		color: #fff;
	}
	.status {
		left: 8px;
		top: 8px;
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px 14px;
	}
	h3 {
		margin: 0;
		font-size: 16px;
	}
	.titel {
		color: inherit;
		text-decoration: none;
	}
	.titel::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.titel:focus-visible {
		outline: none;
	}
	.themen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 2px;
	}
	.thema {
		font-size: 12px;
		font-weight: 600;
		border-radius: 999px;
		padding: 2px 10px;
		background: var(--tint);
		color: var(--ac);
	}
</style>
