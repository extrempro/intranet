<script lang="ts">
	/** Abteilungsseite, Reiter „Videos“ */
	import { resolve } from '$app/paths';
	import EinheitMediathek from '#lib/components/EinheitMediathek.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';

	let { data } = $props();
	const h = $derived(data.einheit);
</script>

<svelte:head><title>Videos · {h.name} · Abteilungen · Intranet</title></svelte:head>

{#if data.mediathek.videos.length}
	<EinheitMediathek unitId={h.id} m={data.mediathek} />
{:else}
	<HubLeer
		titel="Noch keine Videos"
		text="Hier erscheinen Videos der Abteilung, zum Beispiel Anleitungen."
		aktion={data.mediathek.darf
			? { href: `${resolve('/(app)/mediathek/neu')}?einheit=${h.id}`, label: 'Video hochladen' }
			: null}
	/>
{/if}
