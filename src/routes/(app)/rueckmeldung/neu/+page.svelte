<script lang="ts">
	import { resolve } from '$app/paths';
	import RueckmeldungFormular from '#lib/components/RueckmeldungFormular.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Rückmeldung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={data.von}>← Zurück</a>
	<div>
		<h1>Rückmeldung</h1>
		<p class="hinweis">
			Etwas funktioniert nicht oder du hast eine Idee? Fehler liest die IT, Ideen die Verwaltung
			deines Mandanten. Rückfragen kommen über Nachrichten. Den Stand siehst du unter
			<a href={resolve('/(app)/rueckmeldung')}>Meine Meldungen</a>.
		</p>
	</div>
	<div class="karte">
		<RueckmeldungFormular
			von={data.von}
			version={data.version}
			inTeams={data.inTeams}
			eingabe={form?.eingabe ?? null}
			fehlerVomServer={form?.fehler ?? null}
		/>
	</div>
</div>

<style>
	.seite {
		max-width: 40rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
</style>
