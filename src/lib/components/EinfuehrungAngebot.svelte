<script lang="ts">
	/** Beim ersten Besuch: „Kurze Einführung?“ mit Starten / Nein danke (Kap. 13). */
	import { hilfe } from '#lib/hilfe.svelte.ts';
	import type { Tour } from '#lib/tours.ts';

	let { tour, text }: { tour: Tour; text?: string } = $props();
	const offen = $derived(!hilfe.istGesehen(tour.key));
</script>

{#if offen}
	<div class="angebot" role="region" aria-label="Einführung">
		<span>
			{text ??
				`Neu hier? Eine kurze Einführung zeigt dir in ${tour.steps.length} Schritten das Wichtigste.`}
		</span>
		<span class="knoepfe">
			<button class="knopf klein" type="button" onclick={() => hilfe.starten(tour)}>Starten</button>
			<button class="linkknopf" type="button" onclick={() => hilfe.merken(tour.key)}>
				Nein danke
			</button>
		</span>
	</div>
{/if}

<style>
	.angebot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 16px;
		padding: 10px 14px;
		border-radius: 14px;
		background: var(--tint);
		border: 1px solid var(--bd);
	}
	.knoepfe {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 14px;
		font-size: 14px;
	}
</style>
