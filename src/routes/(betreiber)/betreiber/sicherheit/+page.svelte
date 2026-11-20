<script lang="ts">
	// Gleiche Seite wie unter Konto → Sicherheit; dort steht die Logik.
	import Sicherheit from '../../../(app)/konto/sicherheit/+page.svelte';

	let { data, form } = $props();
</script>

<Sicherheit data={data as never} form={form as never} />
