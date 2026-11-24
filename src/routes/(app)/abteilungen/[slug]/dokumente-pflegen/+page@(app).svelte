<script lang="ts">
	/** Abteilung: nur Dokumente pflegen (Recht „Dokumente“) */
	import { resolve } from '$app/paths';
	import SeitenGestaltung from '#lib/components/abteilung/SeitenGestaltung.svelte';

	let { data, form } = $props();
	const e = $derived(data.einheit);
</script>

<svelte:head><title>Dokumente pflegen · {e.name} · Abteilungen · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/abteilungen/[slug]/dokumente', { slug: e.slug })}>
		← Zurück
	</a>
	<div>
		<h1>Dokumente von {e.name}</h1>
		<p class="hinweis">
			Du hast das Recht „Dokumente“: Du legst Dateien ab, benennst sie, sortierst sie in Ordner und
			entfernst sie.
		</p>
	</div>
	<section class="karte">
		{#key e.dokumente.length}
			<SeitenGestaltung einheit={e} nurDokumente meldung={form ?? null} />
		{/key}
	</section>
</div>
