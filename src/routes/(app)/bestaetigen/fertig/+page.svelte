<script lang="ts">
	import { onMount } from 'svelte';
	import { BESTAETIGUNG_KANAL } from '#lib/bestaetigung.ts';

	let { data } = $props();

	onMount(() => {
		if (!data.bis) return;
		try {
			const kanal = new BroadcastChannel(BESTAETIGUNG_KANAL);
			kanal.postMessage({ bis: data.bis });
			kanal.close();
		} catch {
			/* Das Hauptfenster fragt beim Zurückkehren selbst nach */
		}
		window.close();
	});
</script>

<svelte:head>
	<title>Bestätigt · Intranet</title>
</svelte:head>

<div class="stapel">
	<h1>{data.bis ? 'Bestätigt' : 'Nicht bestätigt'}</h1>
	<p>
		{data.bis
			? 'Du kannst dieses Fenster schließen und mit deiner Änderung weitermachen.'
			: 'Die Bestätigung hat nicht geklappt. Schließ dieses Fenster und versuch es noch einmal.'}
	</p>
</div>
