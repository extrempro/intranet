<script lang="ts">
	/** Beiträge eines Hubs als Kacheln mit Vorschaubild. */
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import { formatDay } from '#lib/news.ts';

	let {
		beitraege
	}: { beitraege: { id: string; title: string; publishAt: Date; bild: string | null }[] } =
		$props();
	const BILD =
		'M15 8h.01M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3zM3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3';
</script>

<ul class="beitraege">
	{#each beitraege as b (b.id)}
		<li>
			<a class="karte beitrag" href={resolve('/(app)/neuigkeiten/[id]', { id: b.id })}>
				{#if b.bild}
					<img class="vorschau" src={b.bild} alt="" loading="lazy" />
				{:else}
					<span class="vorschau leer" aria-hidden="true"><Icon d={BILD} size={28} /></span>
				{/if}
				<span class="text">
					<strong>{b.title}</strong>
					<span class="unter">{formatDay(b.publishAt)}</span>
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.beitraege {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr));
		gap: 12px;
	}
	li {
		min-width: 0;
	}
	.beitrag {
		display: flex;
		flex-direction: column;
		height: 100%;
		box-sizing: border-box;
		padding: 0;
		overflow: hidden;
		border-radius: 20px;
		color: var(--tx);
		text-decoration: none;
	}
	.beitrag:hover {
		border-color: var(--ac);
	}
	.vorschau {
		width: 100%;
		height: 120px;
		object-fit: cover;
	}
	.vorschau.leer {
		display: grid;
		place-items: center;
		background: var(--tint);
		color: var(--ac);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		overflow-wrap: anywhere;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
</style>
