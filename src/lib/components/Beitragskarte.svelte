<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatWhen, formatDay } from '#lib/news.ts';
	import Reaktionen from './Reaktionen.svelte';

	interface Item {
		id: string;
		title: string;
		excerpt: string;
		publishAt: Date;
		expiresAt: Date | null;
		urgentUntil: Date | null;
		planned: boolean;
		urgent: boolean;
		wasUrgent: boolean;
		pinned: boolean;
		audience: string;
		sender: { name: string; label: string };
		reactions: { emoji: string; n: number; mine: boolean }[];
	}
	let {
		item,
		mitReaktionen = true,
		ebene = 2
	}: { item: Item; mitReaktionen?: boolean; ebene?: 2 | 3 } = $props();

	const kuerzel = $derived(
		item.sender.name.length <= 3 ? item.sender.name : item.sender.name.charAt(0)
	);
</script>

<article class="karte beitrag" class:dringend={item.urgent}>
	<div class="kopf">
		<span class="kuerzel" aria-hidden="true">{kuerzel}</span>
		<div class="absender">
			<strong>{item.sender.name}</strong>
			<span class="hinweis">
				{item.sender.label} ·
				{#if item.planned}erscheint am {formatWhen(item.publishAt)}{:else}{formatDay(
						item.publishAt
					)}{/if}
			</span>
		</div>
	</div>
	<svelte:element this={`h${ebene}`} class="titel">
		<a class="dehnen" href={resolve('/(app)/neuigkeiten/[id]', { id: item.id })}>{item.title}</a>
	</svelte:element>
	<p>{item.excerpt}</p>
	<div class="schilder">
		{#if item.urgent && item.urgentUntil}<span class="schild rot">
				Dringend bis {formatWhen(item.urgentUntil)}
			</span>{/if}
		{#if item.pinned}<span class="schild">Angeheftet</span>{/if}
		{#if item.planned}<span class="schild rand">Geplant</span>{/if}
		{#if item.audience}<span class="schild rand">{item.audience}</span>{/if}
		{#if item.expiresAt}<span class="schild rand">bis {formatDay(item.expiresAt)}</span>{/if}
	</div>
	{#if item.wasUrgent && item.urgentUntil}
		<p class="hinweis">War dringend bis {formatWhen(item.urgentUntil)}.</p>
	{/if}
	{#if mitReaktionen && !item.planned}<Reaktionen
			newsId={item.id}
			reaktionen={item.reactions}
		/>{/if}
</article>

<style>
	.beitrag {
		position: relative;
		display: grid;
		gap: 8px;
		transition: box-shadow 0.15s ease;
	}
	.beitrag:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.1);
	}
	.beitrag:has(.dehnen:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.beitrag.dringend {
		border: 2px solid var(--err-bd);
	}
	.kopf {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.kuerzel {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 13px;
		flex: none;
	}
	.absender {
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}
	.titel {
		margin: 0;
		font-size: 1.1rem;
	}
	.dehnen {
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
		border-radius: inherit;
	}
	p {
		margin: 0;
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.schild.rot {
		background: #b42318;
		color: #fff;
	}
</style>
