<script lang="ts">
	import { untrack } from 'svelte';
	import { BG_DEFAULT, BG_DEFAULT_DARK, checkAccent, checkBackground, HEX } from '#lib/color.ts';

	let {
		werte
	}: {
		werte: {
			name: string;
			shortName: string;
			accent: string;
			accentDark: string;
			bg?: string;
			bgDark?: string;
		};
	} = $props();

	let akzent = $state(untrack(() => werte.accent));
	let akzentDunkel = $state(untrack(() => werte.accentDark));
	const gueltig = $derived(HEX.test(akzent) && HEX.test(akzentDunkel));
	const pruefung = $derived(gueltig ? checkAccent(akzent, akzentDunkel) : null);
	const zahl = (n: number) => `${n.toFixed(1).replace('.', ',')}:1`;

	let hintergrund = $state(untrack(() => werte.bg ?? ''));
	let hintergrundDunkel = $state(untrack(() => werte.bgDark ?? ''));
	const bgOk = $derived(
		(hintergrund === '' || HEX.test(hintergrund)) &&
			(hintergrundDunkel === '' || HEX.test(hintergrundDunkel))
	);
	const bgPruefung = $derived(
		gueltig && bgOk
			? checkBackground(
					hintergrund || BG_DEFAULT,
					hintergrundDunkel || BG_DEFAULT_DARK,
					akzent,
					akzentDunkel
				)
			: null
	);
	const minimum = (o: { text: number; gedaempft: number; akzent: number }) =>
		Math.min(o.text, o.gedaempft, o.akzent);
</script>

<label class="feld">
	<span>Name</span>
	<input name="name" required minlength="2" maxlength="120" value={werte.name} />
</label>
<label class="feld">
	<span>Kürzel</span>
	<input name="kuerzel" required maxlength="10" value={werte.shortName} />
	<span class="hinweis">Erscheint oben links, solange kein Logo hochgeladen ist, z. B. HSO.</span>
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

<fieldset class="gruppe">
	<legend>Seitenhintergrund</legend>
	<p class="hinweis">
		Die Fläche hinter den Karten. Leer lassen für den Standard ({BG_DEFAULT} hell, {BG_DEFAULT_DARK}
		dunkel).
	</p>
	<div class="farben">
		<label class="feld">
			<span>Hell</span>
			<span class="farbzeile">
				<input
					type="color"
					value={hintergrund || BG_DEFAULT}
					oninput={(e) => (hintergrund = e.currentTarget.value)}
					aria-label="Hintergrund hell wählen"
				/>
				<input
					name="hintergrund"
					bind:value={hintergrund}
					pattern="#[0-9a-fA-F]{'{6}'}"
					placeholder="Standard"
				/>
				{#if hintergrund}<button type="button" class="linkknopf" onclick={() => (hintergrund = '')}>
						Standard
					</button>{/if}
			</span>
		</label>
		<label class="feld">
			<span>Dunkel</span>
			<span class="farbzeile">
				<input
					type="color"
					value={hintergrundDunkel || BG_DEFAULT_DARK}
					oninput={(e) => (hintergrundDunkel = e.currentTarget.value)}
					aria-label="Hintergrund dunkel wählen"
				/>
				<input
					name="hintergrund_dunkel"
					bind:value={hintergrundDunkel}
					pattern="#[0-9a-fA-F]{'{6}'}"
					placeholder="Standard"
				/>
				{#if hintergrundDunkel}<button
						type="button"
						class="linkknopf"
						onclick={() => (hintergrundDunkel = '')}
					>
						Standard
					</button>{/if}
			</span>
		</label>
	</div>
	{#if bgPruefung}
		<div class="vorschau" aria-hidden="true">
			<span class="flaeche" style="background: {hintergrund || BG_DEFAULT}; --a: {akzent}">
				<b style="color: #18201c">Überschrift</b><span style="color: #525c57">grauer Text</span><i>
					Link
				</i>
			</span>
			<span
				class="flaeche"
				style="background: {hintergrundDunkel || BG_DEFAULT_DARK}; --a: {akzentDunkel}"
			>
				<b style="color: #eaefec">Überschrift</b><span style="color: #a6b0ab">grauer Text</span><i>
					Link
				</i>
			</span>
		</div>
		<p class:fehltext={!bgPruefung.ok} class="hinweis" aria-live="polite">
			Kontrast (mindestens 4,5:1): hell {zahl(minimum(bgPruefung.hell))}, dunkel {zahl(
				minimum(bgPruefung.dunkel)
			)} – {bgPruefung.ok ? 'passt' : 'zu wenig, bitte heller bzw. dunkler wählen'}.
		</p>
	{/if}
</fieldset>

<style>
	.flaeche {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 12px;
		border: 1px solid var(--bd);
	}
	.flaeche i {
		color: var(--a);
		font-style: normal;
		font-weight: 600;
		text-decoration: underline;
	}
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
