<script lang="ts">
	/**
	 * Beim ersten Besuch: schmale Zeile über dem Titel „Neu hier? …“ mit
	 * Nein danke / Starten (Kap. 13, Gestaltung nach Entwurf).
	 */
	import { hilfe } from '#lib/hilfe.svelte.ts';
	import type { Tour } from '#lib/tours.ts';

	let { tour, text }: { tour: Tour; text?: string } = $props();
	const offen = $derived(!hilfe.istGesehen(tour.key));
</script>

{#if offen}
	<div class="angebot" role="region" aria-label="Einführung">
		<span class="frage" aria-hidden="true">?</span>
		<span class="text">
			{text ?? `Neu hier? Kurze Einführung zu „${tour.title}“ in ${tour.steps.length} Schritten.`}
		</span>
		<span class="knoepfe">
			<button class="nein" type="button" onclick={() => hilfe.merken(tour.key)}>Nein danke</button>
			<button class="knopf zweit klein" type="button" onclick={() => hilfe.starten(tour)}>
				Starten
			</button>
		</span>
	</div>
{/if}

<style>
	.angebot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		padding: 8px 12px;
		border-radius: 12px;
		border: 1px dashed var(--bd);
		background: var(--sf);
	}
	.frage {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 999px;
		background: var(--tint);
		color: var(--ac);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 13px;
	}
	.text {
		flex: 1 1 220px;
		font-size: 14px;
	}
	.knoepfe {
		display: flex;
		gap: 6px;
	}
	.nein {
		background: transparent;
		border: 0;
		padding: 0 8px;
		min-height: 36px;
		color: var(--mu);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
	}
	.klein {
		min-height: 36px;
		padding: 4px 14px;
		font-size: 14px;
	}
</style>
