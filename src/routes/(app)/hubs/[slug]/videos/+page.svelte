<script lang="ts">
	/** Hub-Seite, Reiter „Videos“ */
	import { resolve } from '$app/paths';
	import EinheitMediathek from '#lib/components/EinheitMediathek.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';

	let { data } = $props();
	const h = $derived(data.hub);
</script>

<svelte:head><title>Videos · {h.name} · Hubs · Intranet</title></svelte:head>

{#if data.mediathek.videos.length}
	<EinheitMediathek unitId={h.id} m={data.mediathek} />
{:else}
	<HubLeer
		titel="Noch keine Videos"
		text="Hier erscheinen Videos zu diesem Thema, zum Beispiel Mitschnitte oder Anleitungen."
		aktion={data.mediathek.darf
			? { href: `${resolve('/(app)/mediathek/neu')}?einheit=${h.id}`, label: 'Video hochladen' }
			: null}
	/>
{/if}
