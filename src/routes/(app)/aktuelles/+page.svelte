<script lang="ts">
	import { resolve } from '$app/paths';
	import Bereichsliste from '#lib/components/Bereichsliste.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { navAreas } from '#lib/nav.ts';

	let { data } = $props();
	const bereich = navAreas().find((a) => a.key === 'aktuelles')!;
	const zeilen = $derived(
		bereich.pages.map((p) => {
			const neu = p.key === 'neuigkeiten' ? data.neueBeitraege : 0;
			const text =
				neu > 0
					? neu === 1
						? '1 neuer Beitrag'
						: `${neu} neue Beiträge`
					: (data.texte[p.key] ?? p.text);
			return { ...p, text, zahl: neu };
		})
	);
	const erster = $derived(data.angeheftet[0]);
</script>

<svelte:head><title>Aktuelles · Intranet</title></svelte:head>

<div class="stapel">
	<h1>Aktuelles</h1>
	{#if erster}
		<a class="angeheftet" href={resolve('/(app)/neuigkeiten/[id]', { id: erster.id })}>
			<span class="text">
				<span class="marke">Angeheftet · {data.angeheftet.length}</span>
				<strong>{erster.title}</strong>
			</span>
			<Icon d="M9 6l6 6l-6 6" size={18} stroke={2} />
		</a>
	{/if}
	<Bereichsliste {zeilen} />
</div>

<style>
	.stapel {
		gap: 16px;
	}
	.angeheftet {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
		border-radius: 18px;
		background: var(--tint);
		color: var(--tx);
		text-decoration: none;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.marke {
		font-size: 13px;
		font-weight: 700;
		color: var(--ac);
	}
	.angeheftet :global(svg) {
		color: var(--ac);
	}
</style>
