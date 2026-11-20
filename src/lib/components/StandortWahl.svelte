<script lang="ts">
	/** „Mein Standort“: Auswahl der Kantinen-Standorte (Kap. 8.7, 12). */
	import { enhance } from '$app/forms';

	let {
		alle,
		meine,
		action = '?/standorte'
	}: {
		alle: { id: string; name: string; address: string | null; tenantShort: string }[];
		meine: string[];
		action?: string;
	} = $props();
</script>

<form
	method="POST"
	{action}
	class="felder"
	use:enhance={() =>
		({ update }) =>
			update({ reset: false })}
>
	<fieldset class="wahl">
		<legend>Meine Standorte</legend>
		<p class="hinweis">Du siehst dann Speiseplan und Öffnungszeiten dieser Kantinen.</p>
		{#each alle as l (l.id)}
			<label class="zeile">
				<input type="checkbox" name="standort" value={l.id} checked={meine.includes(l.id)} />
				<span>
					<strong>{l.name}</strong>
					<span class="hinweis">{[l.address, l.tenantShort].filter(Boolean).join(' · ')}</span>
				</span>
			</label>
		{/each}
	</fieldset>
	<button class="knopf" type="submit">Speichern</button>
</form>

<style>
	.wahl {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		cursor: pointer;
	}
	.zeile input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.zeile > span {
		display: flex;
		flex-direction: column;
	}
</style>
