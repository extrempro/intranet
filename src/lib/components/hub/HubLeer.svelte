<script lang="ts">
	/** Platzhalter für einen leeren Bereich der Hub-Seite, mit Knopf für alle, die ihn füllen dürfen. */
	let {
		titel,
		text,
		aktion
	}: { titel: string; text: string; aktion?: { href: string; label: string } | null } = $props();
</script>

<div class="leer">
	<p class="titel">{titel}</p>
	<p class="hinweis">{text}</p>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Ziel kommt schon aufgelöst -->
	{#if aktion}<a class="knopf" href={aktion.href}>{aktion.label}</a>{/if}
</div>

<style>
	.leer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 32px 20px;
		text-align: center;
		border: 2px dashed var(--bd);
		border-radius: 20px;
	}
	.titel {
		margin: 0;
		font-weight: 700;
		font-size: 1.1em;
	}
	.hinweis {
		margin: 0 0 8px;
		max-width: 440px;
	}
</style>
