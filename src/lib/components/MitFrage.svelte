<script lang="ts">
	/**
	 * Knopf, der vor dem Absenden nachfragt (Design-Regel: Bestätigung immer
	 * als eigenes Fenster, src/lib/frage.svelte.ts). Das Formular selbst ist
	 * unsichtbar; nach „Ja“ wird es abgeschickt.
	 */
	import { enhance as kitEnhance, type SubmitFunction } from '$app/forms';
	import type { Snippet } from 'svelte';
	import { frage, type Frage } from '#lib/frage.svelte.ts';

	let {
		ausloeser,
		imFormular = false,
		action,
		knopf,
		knopfKlasse = 'linkknopf',
		knopfLabel,
		frage: f,
		enhance = false,
		felder,
		inhalt
	}: {
		/** Ziel der Formular-Aktion, z. B. „?/loeschen“ */
		action: string;
		/** Beschriftung des Knopfs */
		knopf?: string;
		knopfKlasse?: string;
		/** Zugänglicher Name, wenn der Knopf nur ein Symbol zeigt */
		knopfLabel?: string;
		frage: Frage;
		/** Mit use:enhance absenden (ohne Neuladen der Seite), optional mit eigener Funktion */
		enhance?: boolean | SubmitFunction;
		/** Versteckte Felder (z. B. die ID) */
		felder?: Snippet;
		/** Eigener Inhalt des Knopfs statt Text */
		inhalt?: Snippet;
		/**
		 * Eigener Knopf (Styles der Seite gelten nur dort, wo das Markup steht):
		 * {#snippet ausloeser(klick)}<button type="button" class="…" onclick={klick}>…</button>{/snippet}
		 */
		ausloeser?: Snippet<[() => void]>;
		/**
		 * Knopf steht schon in einem Formular (z. B. mit der ID): dieses wird mit
		 * formaction={action} abgeschickt, statt eines eigenen Formulars.
		 */
		imFormular?: boolean;
	} = $props();

	let formular: HTMLFormElement | undefined = $state();
	let senden: HTMLButtonElement | undefined = $state();

	async function klick() {
		if (!(await frage(f))) return;
		if (imFormular) senden?.form?.requestSubmit(senden);
		else formular?.requestSubmit();
	}
</script>

{#if ausloeser}
	{@render ausloeser(() => void klick())}
{:else}
	<button type="button" class={knopfKlasse} aria-label={knopfLabel} onclick={klick}>
		{#if inhalt}{@render inhalt()}{:else}{knopf}{/if}
	</button>
{/if}
{#if imFormular}
	<button
		bind:this={senden}
		type="submit"
		formaction={action}
		hidden
		tabindex="-1"
		aria-hidden="true"
	>
		Senden
	</button>
{:else if enhance}
	<form
		bind:this={formular}
		method="POST"
		{action}
		hidden
		use:kitEnhance={typeof enhance === 'function' ? enhance : undefined}
	>
		{@render felder?.()}
	</form>
{:else}
	<form bind:this={formular} method="POST" {action} hidden>
		{@render felder?.()}
	</form>
{/if}
