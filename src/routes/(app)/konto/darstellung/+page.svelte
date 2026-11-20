<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const optionen = [
		{ wert: 'auto', text: 'Automatisch', hinweis: 'Folgt der Einstellung deines Geräts' },
		{ wert: 'hell', text: 'Hell', hinweis: '' },
		{ wert: 'dunkel', text: 'Dunkel', hinweis: '' }
	];
</script>

<svelte:head><title>Darstellung · Konto · Intranet</title></svelte:head>

<div class="stapel schmal">
	<h1>Darstellung</h1>
	<form
		method="POST"
		action="?/setzen"
		class="felder"
		use:enhance={({ formData }) => {
			document.documentElement.dataset.theme = String(formData.get('wert'));
			return async ({ update }) => update({ reset: false });
		}}
	>
		{#if form?.gespeichert}<p class="meldung" role="status">
				Gespeichert. Gilt auf allen deinen Geräten.
			</p>{/if}
		<fieldset class="karte">
			<legend>Farbschema</legend>
			{#each optionen as o (o.wert)}
				<label class="option">
					<input type="radio" name="wert" value={o.wert} checked={data.gewaehlt === o.wert} />
					<span>
						{o.text}{#if o.hinweis}<br /><span class="hinweis">{o.hinweis}</span>{/if}
					</span>
				</label>
			{/each}
		</fieldset>
		<button class="knopf" type="submit">Speichern</button>
	</form>
</div>

<style>
	.schmal {
		max-width: 36rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
	}
	.option input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
</style>
