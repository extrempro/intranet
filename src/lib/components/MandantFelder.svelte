<script lang="ts">
	/**
	 * Name, Kürzel und Oberflächenfarben eines Mandanten, je Darstellung hell
	 * und dunkel getrennt. Leere Felder = Standard bzw. abgeleitet; Vorschau
	 * und Kontrastprüfung (mindestens 4,5:1) wie auf dem Server.
	 */
	import { untrack } from 'svelte';
	import {
		FARB_FELDER,
		FARB_NAMEN,
		HEX,
		palette,
		pruefePalette,
		type FarbFeld,
		type Modus,
		type UiFarben
	} from '#lib/color.ts';

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
			ui?: UiFarben;
			privacyUrl?: string;
			imprintUrl?: string;
		};
	} = $props();

	type Satz = Record<'akzent' | FarbFeld, string>;
	const start = (m: Modus): Satz => {
		const ui = werte.ui?.[m] ?? {};
		return {
			akzent: m === 'hell' ? werte.accent : werte.accentDark,
			knopf: ui.knopf ?? '',
			hintergrund: (m === 'hell' ? werte.bg : werte.bgDark) ?? '',
			flaeche: ui.flaeche ?? '',
			rahmen: ui.rahmen ?? '',
			text: ui.text ?? '',
			grau: ui.grau ?? ''
		};
	};
	let farben = $state(untrack(() => ({ hell: start('hell'), dunkel: start('dunkel') })));

	const MODI: { m: Modus; titel: string }[] = [
		{ m: 'hell', titel: 'Hell' },
		{ m: 'dunkel', titel: 'Dunkel' }
	];
	const HINWEISE: Partial<Record<FarbFeld, string>> = {
		knopf: 'Gefüllte Knöpfe und aktive Pillen, weiße Schrift',
		flaeche: 'Kopfzeile, Seitenleiste, Karten',
		hintergrund: 'Fläche hinter den Karten'
	};

	/** Feldname im Formular (Hintergrund und Akzent behalten ihre alten Namen) */
	const feldName = (m: Modus, f: 'akzent' | FarbFeld) =>
		f === 'akzent'
			? m === 'hell'
				? 'akzent'
				: 'akzent_dunkel'
			: f === 'hintergrund'
				? m === 'hell'
					? 'hintergrund'
					: 'hintergrund_dunkel'
				: `farbe_${m}_${f}`;

	const wirksam = $derived(
		Object.fromEntries(
			MODI.map(({ m }) => {
				const f = farben[m];
				const ok = (v: string) => (HEX.test(v) ? v : undefined);
				const akzentHell = HEX.test(farben.hell.akzent) ? farben.hell.akzent : '#0F6E56';
				const akzent = HEX.test(f.akzent) ? f.akzent : akzentHell;
				const p = palette(m, akzent, akzentHell, {
					knopf: ok(f.knopf),
					hintergrund: ok(f.hintergrund),
					flaeche: ok(f.flaeche),
					rahmen: ok(f.rahmen),
					text: ok(f.text),
					grau: ok(f.grau)
				});
				return [m, { p, k: pruefePalette(p) }];
			})
		) as Record<Modus, { p: ReturnType<typeof palette>; k: ReturnType<typeof pruefePalette> }>
	);
	const zahl = (n: number) => `${n.toFixed(1).replace('.', ',')}:1`;
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

<label class="feld">
	<span>Datenschutzerklärung (Link)</span>
	<input
		name="datenschutz"
		type="url"
		maxlength="500"
		placeholder="https://…"
		value={werte.privacyUrl ?? ''}
	/>
</label>
<label class="feld">
	<span>Impressum (Link)</span>
	<input
		name="impressum"
		type="url"
		maxlength="500"
		placeholder="https://…"
		value={werte.imprintUrl ?? ''}
	/>
	<span class="hinweis">
		Erscheinen auf der Anmeldeseite und im Kontomenü. Leer lassen, wenn es keine gibt.
	</span>
</label>

<div class="modi">
	{#each MODI as { m, titel } (m)}
		{@const w = wirksam[m]}
		<fieldset class="gruppe">
			<legend>Farben {titel.toLowerCase()}</legend>
			{#each ['akzent', ...FARB_FELDER] as const as f (f)}
				{@const pflicht = f === 'akzent'}
				<label class="zeile">
					<span class="name">
						{f === 'akzent' ? 'Akzent (Links, Markierungen)' : FARB_NAMEN[f]}
						{#if HINWEISE[f as FarbFeld]}<span class="hinweis">{HINWEISE[f as FarbFeld]}</span>{/if}
					</span>
					<span class="farbzeile">
						<input
							type="color"
							value={HEX.test(farben[m][f]) ? farben[m][f] : w.p[f]}
							oninput={(e) => (farben[m][f] = e.currentTarget.value.toUpperCase())}
							aria-label="{titel}: {f === 'akzent' ? 'Akzent' : FARB_NAMEN[f]} wählen"
						/>
						<input
							name={feldName(m, f)}
							bind:value={farben[m][f]}
							pattern="#[0-9a-fA-F]{'{6}'}"
							required={pflicht}
							placeholder={pflicht ? '' : `Standard ${w.p[f]}`}
							aria-label="{titel}: {f === 'akzent' ? 'Akzent' : FARB_NAMEN[f]} als Hex-Wert"
						/>
						{#if !pflicht && farben[m][f]}<button
								type="button"
								class="linkknopf"
								onclick={() => (farben[m][f] = '')}
								aria-label="{titel}: {FARB_NAMEN[f]} auf Standard"
							>
								Standard
							</button>{/if}
					</span>
				</label>
			{/each}

			<div
				class="vorschau"
				aria-hidden="true"
				style:background={w.p.hintergrund}
				style:color={w.p.text}
			>
				<div class="karte-muster" style:background={w.p.flaeche} style:border-color={w.p.rahmen}>
					<b>Überschrift</b>
					<span style:color={w.p.grau}>Grauer Text</span>
					<span class="muster-link" style:color={w.p.akzent}>Link</span>
					<span class="muster-knopf" style:background={w.p.knopf}>Knopf</span>
				</div>
				<span style:color={w.p.grau}>Text auf dem Hintergrund</span>
			</div>
			<p class:fehltext={!w.k.ok} class="hinweis" aria-live="polite">
				Kontrast (mindestens 4,5:1): Text {zahl(w.k.text)}, grau {zahl(w.k.grau)}, Links {zahl(
					w.k.akzent
				)}, Knöpfe {zahl(w.k.knopf)} – {w.k.ok ? 'passt' : 'zu wenig, so wird nicht gespeichert'}.
			</p>
		</fieldset>
	{/each}
</div>

<style>
	.modi {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 14px;
	}
	.gruppe {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 10px 16px 14px;
		margin: 0;
		display: grid;
		gap: 10px;
		min-width: 0;
	}
	legend {
		font-weight: 700;
	}
	.zeile {
		display: grid;
		gap: 4px;
	}
	.name {
		display: flex;
		flex-direction: column;
		font-size: 14px;
		font-weight: 600;
	}
	.name .hinweis {
		font-weight: 400;
		font-size: 13px;
	}
	.farbzeile {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.farbzeile input:not([type='color']) {
		flex: 1;
		min-width: 0;
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
		padding: 14px;
		border-radius: 12px;
		border: 1px solid var(--bd);
		display: grid;
		gap: 8px;
		font-size: 14px;
	}
	.karte-muster {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
		padding: 12px;
		border: 1px solid;
		border-radius: 12px;
	}
	.muster-link {
		font-weight: 600;
		text-decoration: underline;
	}
	.muster-knopf {
		color: #fff;
		font-weight: 600;
		padding: 6px 12px;
		border-radius: 8px;
	}
	.fehltext {
		color: var(--err-tx);
		font-weight: 600;
	}
</style>
