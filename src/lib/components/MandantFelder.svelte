<script lang="ts">
	import { untrack } from 'svelte';
	import { checkAccent, HEX } from '#lib/color.ts';

	let {
		werte
	}: { werte: { name: string; shortName: string; accent: string; accentDark: string } } = $props();

	let akzent = $state(untrack(() => werte.accent));
	let akzentDunkel = $state(untrack(() => werte.accentDark));
	const gueltig = $derived(HEX.test(akzent) && HEX.test(akzentDunkel));
	const pruefung = $derived(gueltig ? checkAccent(akzent, akzentDunkel) : null);
	const zahl = (n: number) => `${n.toFixed(1).replace('.', ',')}:1`;
</script>

<label class="feld">
	<span>Name</span>
	<input name="name" required minlength="2" maxlength="120" value={werte.name} />
</label>
<label class="feld">
	<span>Kürzel</span>
	<input name="kuerzel" required maxlength="10" value={werte.shortName} />
	<span class="hinweis">Erscheint im Logo-Feld oben links, z. B. BH.</span>
</label>

<fieldset class="gruppe">
	<legend>Akzentfarbe</legend>
	<div class="farben">
		<label class="feld">
			<span>Hell</span>
			<span class="farbzeile">
				<input type="color" bind:value={akzent} aria-label="Akzentfarbe hell wählen" />
				<input name="akzent" bind:value={akzent} pattern="#[0-9a-fA-F]{'{6}'}" required />
			</span>
		</label>
		<label class="feld">
			<span>Dunkel</span>
			<span class="farbzeile">
				<input type="color" bind:value={akzentDunkel} aria-label="Akzentfarbe dunkel wählen" />
				<input
					name="akzent_dunkel"
					bind:value={akzentDunkel}
					pattern="#[0-9a-fA-F]{'{6}'}"
					required
				/>
			</span>
		</label>
	</div>

	{#if pruefung}
		<div class="vorschau" aria-hidden="true">
			<span class="muster hell" style="--a: {akzent}"><b>Knopf</b><i>Link</i></span>
			<span class="muster dunkel" style="--a: {akzentDunkel}">
				<b style="background: {akzent}">Knopf</b><i>Link</i>
			</span>
		</div>
		<p class:fehltext={!pruefung.ok} class="hinweis" aria-live="polite">
			Kontrast (mindestens 4,5:1): Knopf {zahl(pruefung.weissAufAkzent)}, Link hell {zahl(
				pruefung.akzentAufHell
			)}, Link dunkel {zahl(pruefung.dunkelAufDunkel)} – {pruefung.ok
				? 'passt'
				: 'zu wenig, bitte dunkler bzw. heller wählen'}.
		</p>
	{/if}
</fieldset>

<style>
	.gruppe {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 10px 16px 14px;
		margin: 0;
		display: grid;
		gap: 10px;
	}
	.farben {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}
	.farbzeile {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	input[type='color'] {
		width: 48px;
		height: 44px;
		padding: 2px;
		border: 1px solid var(--inp-bd);
		border-radius: 10px;
		background: var(--sf);
		flex: none;
	}
	.vorschau {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.muster {
		display: inline-flex;
		align-items: center;
		gap: 14px;
		padding: 10px 14px;
		border-radius: 12px;
		border: 1px solid var(--bd);
	}
	.muster.hell {
		background: #ffffff;
	}
	.muster.dunkel {
		background: #1a201d;
	}
	.muster b {
		background: var(--a);
		color: #fff;
		padding: 6px 12px;
		border-radius: 8px;
	}
	.muster i {
		color: var(--a);
		font-style: normal;
		font-weight: 600;
		text-decoration: underline;
	}
	.fehltext {
		color: var(--err-tx);
		font-weight: 600;
	}
</style>
