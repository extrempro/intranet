<script lang="ts">
	/** „?“ neben der Überschrift: Einführung jederzeit erneut starten (Kap. 13). */
	import { hilfe } from '#lib/hilfe.svelte.ts';
	import type { Tour } from '#lib/tours.ts';

	let { tour }: { tour: Tour } = $props();
</script>

<button
	class="fragezeichen"
	type="button"
	aria-label="Einführung: {tour.title}"
	title="Einführung zu dieser Seite"
	onclick={() => hilfe.starten(tour)}
>
	?
</button>

<style>
	.fragezeichen {
		width: 32px;
		height: 32px;
		min-width: 32px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--ac);
		font-weight: 800;
		cursor: pointer;
		/* Größere Trefferfläche ohne größeres Symbol */
		position: relative;
	}
	.fragezeichen::after {
		content: '';
		position: absolute;
		inset: -6px;
	}
</style>
