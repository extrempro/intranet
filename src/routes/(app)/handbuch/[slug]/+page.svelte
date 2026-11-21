<script lang="ts">
	import HandbuchArtikel from '#lib/components/HandbuchArtikel.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.meta.title} · Handbuch · Intranet</title></svelte:head>

<HandbuchArtikel
	titel={data.meta.title}
	kapitel={data.kapitel}
	rollen={data.rollen}
	html={data.html}
	vorher={data.vorher}
	nachher={data.nachher}
	zurueck
/>
