<script lang="ts">
	import HandbuchArtikel from '#lib/components/HandbuchArtikel.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Handbuch · Intranet</title></svelte:head>

{#if data.start}
	<HandbuchArtikel
		titel={data.start.meta.title}
		kapitel="Grundlagen"
		rollen={null}
		html={data.start.html}
	/>
{/if}
