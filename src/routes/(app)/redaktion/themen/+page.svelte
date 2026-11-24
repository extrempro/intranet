<script lang="ts">
	/** Themen der Mediathek und FAQs (Kap. 8.15) */
	import ThemenPflege from '#lib/components/ThemenPflege.svelte';

	let { data, form } = $props();
</script>

<ThemenPflege {data} {form} bereich="Redaktion" />
