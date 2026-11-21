<script lang="ts">
	import { resolve } from '$app/paths';
	import FaqFormular from '#lib/components/FaqFormular.svelte';

	import EntwurfHinweis from '#lib/components/EntwurfHinweis.svelte';
	import EntwurfSpeichern from '#lib/components/EntwurfSpeichern.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Neue FAQ · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/faqs')}>← FAQs</a>
	<h1>Neue FAQ</h1>
	<EntwurfHinweis art="faq" entwuerfe={data.entwuerfe} />
	{#key form ?? data.entwurf?.id}
		<form method="POST" class="felder karte">
			<FaqFormular
				einheiten={data.einheiten}
				werte={form?.werte ?? data.werte}
				fehler={form?.fehler ?? {}}
			/>
			<div class="aktionen">
				<button class="knopf" type="submit">Speichern</button>
				<a class="knopf zweit" href={resolve('/(app)/faqs')}>Abbrechen</a>
			</div>
			<EntwurfSpeichern
				art="faq"
				id={form?.entwurf ?? data.entwurf?.id ?? null}
				gespeichert={data.entwurf?.gespeichert ?? null}
			/>
		</form>
	{/key}
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	h1 {
		margin: 0;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
</style>
