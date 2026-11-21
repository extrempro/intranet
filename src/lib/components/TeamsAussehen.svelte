<script lang="ts">
	/**
	 * Aussehen der Teams-App: Name, Beschreibung, Herausgeber, Farbe und
	 * Symbol. Ohne eigene Angaben gilt das Branding des Hauptmandanten. Der
	 * Browser rechnet das Symbol in die beiden Größen für Teams um.
	 */
	import { enhance, type SubmitFunction } from '$app/forms';
	import { hierBleiben } from '#lib/formular.ts';

	interface Marke {
		kurzname: string;
		langname: string;
		kurzbeschreibung: string;
		langbeschreibung: string;
		herausgeber: string;
		farbe: string;
	}
	let {
		aussehen
	}: {
		aussehen: {
			gespeichert: Marke;
			standard: Omit<Marke, 'farbe'>;
			farbe: string;
			quelle: 'eigen' | 'mandant' | 'standard';
			eigenerUmriss: boolean;
			farbig: string;
			umriss: string;
		};
	} = $props();

	const uid = $props.id();
	// Vorschau folgt den Eingaben, bevor gespeichert wird
	let werte = $derived({ ...aussehen.gespeichert });
	const HEX = /^#[0-9a-f]{6}$/i;
	const vorschauFarbe = $derived(HEX.test(werte.farbe) ? werte.farbe : aussehen.farbe);

	let neuFarbig = $state<Blob | null>(null);
	let neuUmriss = $state<Blob | null>(null);
	let vorschauFarbig = $state<string | null>(null);
	let vorschauUmriss = $state<string | null>(null);
	let symbolHinweis = $state('');
	let symbolFehler = $state('');

	function laden(datei: File): Promise<HTMLImageElement> {
		return new Promise((ok, nein) => {
			const url = URL.createObjectURL(datei);
			const img = new Image();
			img.onload = () => ok(img);
			img.onerror = () => nein(new Error('Das Bild konnte nicht gelesen werden.'));
			img.src = url;
		});
	}
	const alsPng = (c: HTMLCanvasElement): Promise<Blob> =>
		new Promise((ok, nein) =>
			c.toBlob((b) => (b ? ok(b) : nein(new Error('Umrechnen fehlgeschlagen.'))), 'image/png')
		);

	async function gewaehlt(e: Event & { currentTarget: HTMLInputElement }) {
		symbolFehler = '';
		symbolHinweis = '';
		neuFarbig = neuUmriss = null;
		vorschauFarbig = vorschauUmriss = null;
		const datei = e.currentTarget.files?.[0];
		if (!datei) return;
		if (datei.size > 10_000_000) {
			symbolFehler = 'Die Datei ist zu groß (höchstens 10 MB).';
			return;
		}
		try {
			const img = await laden(datei);
			const w = img.naturalWidth || 512;
			const h = img.naturalHeight || 512;
			const seite = Math.min(w, h);
			const [sx, sy] = [(w - seite) / 2, (h - seite) / 2];
			const zeichne = (n: number) => {
				const c = document.createElement('canvas');
				c.width = c.height = n;
				const ctx = c.getContext('2d')!;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(img, sx, sy, seite, seite, 0, 0, n, n);
				return c;
			};
			neuFarbig = await alsPng(zeichne(192));
			vorschauFarbig = URL.createObjectURL(neuFarbig);

			// Umriss aus demselben Bild; geht nur mit durchsichtigem Hintergrund
			const umriss = await alsUmriss(img);
			if (umriss) {
				neuUmriss = umriss;
				vorschauUmriss = URL.createObjectURL(umriss);
			} else {
				symbolHinweis =
					'Das Bild hat keinen durchsichtigen Hintergrund. Lade unten ein eigenes Umriss-Symbol hoch, sonst nimmt Teams ein einfaches Standard-Symbol.';
			}
		} catch (err) {
			symbolFehler = err instanceof Error ? err.message : 'Das Bild konnte nicht gelesen werden.';
		}
	}

	/**
	 * Umriss-Symbol für Teams: 32 × 32, weiß auf durchsichtig. Die Deckkraft bleibt
	 * erhalten (weiche Kanten) und wird verstärkt, damit dünne Linien beim
	 * Verkleinern nicht verschwinden. null, wenn der Hintergrund nicht durchsichtig ist.
	 */
	async function alsUmriss(img: HTMLImageElement): Promise<Blob | null> {
		const w = img.naturalWidth || 512;
		const h = img.naturalHeight || 512;
		const seite = Math.min(w, h);
		const k = document.createElement('canvas');
		k.width = k.height = 32;
		const ctx = k.getContext('2d')!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, (w - seite) / 2, (h - seite) / 2, seite, seite, 0, 0, 32, 32);
		const daten = ctx.getImageData(0, 0, 32, 32);
		let durchsichtig = 0;
		for (let i = 3; i < daten.data.length; i += 4) if (daten.data[i] < 128) durchsichtig++;
		if (durchsichtig / (32 * 32) <= 0.1) return null;
		for (let i = 0; i < daten.data.length; i += 4) {
			const a = daten.data[i + 3];
			daten.data[i] = daten.data[i + 1] = daten.data[i + 2] = 255;
			daten.data[i + 3] = a < 16 ? 0 : Math.min(255, Math.round(a * 1.8));
		}
		ctx.putImageData(daten, 0, 0);
		return alsPng(k);
	}

	/** Eigenes Umriss-Symbol, unabhängig vom farbigen Symbol. */
	async function umrissGewaehlt(e: Event & { currentTarget: HTMLInputElement }) {
		symbolFehler = '';
		symbolHinweis = '';
		neuUmriss = null;
		vorschauUmriss = null;
		const datei = e.currentTarget.files?.[0];
		if (!datei) return;
		if (datei.size > 10_000_000) {
			symbolFehler = 'Die Datei ist zu groß (höchstens 10 MB).';
			return;
		}
		try {
			const umriss = await alsUmriss(await laden(datei));
			if (!umriss) {
				symbolFehler =
					'Das Umriss-Symbol braucht einen durchsichtigen Hintergrund. Teams zeigt nur die deckenden Stellen, in Weiß.';
				return;
			}
			neuUmriss = umriss;
			vorschauUmriss = URL.createObjectURL(umriss);
		} catch (err) {
			symbolFehler = err instanceof Error ? err.message : 'Das Bild konnte nicht gelesen werden.';
		}
	}

	const hochladen: SubmitFunction = (eingabe) => {
		// „Eigene Symbole entfernen“ schickt nur zuruecksetzen=ja
		if (eingabe.submitter?.getAttribute('value') !== 'ja') {
			if (!neuFarbig && !neuUmriss) return eingabe.cancel();
			if (neuFarbig) eingabe.formData.set('farbig', neuFarbig, 'farbig.png');
			if (neuUmriss) eingabe.formData.set('umriss', neuUmriss, 'umriss.png');
		}
		const weiter = hierBleiben();
		return async (opts) => {
			await weiter(opts);
			if (opts.result.type === 'success') {
				neuFarbig = neuUmriss = null;
				vorschauFarbig = vorschauUmriss = null;
				symbolHinweis = '';
			}
		};
	};

	const QUELLE = {
		eigen: 'Eigenes Symbol',
		mandant: 'App-Symbol des Hauptmandanten',
		standard: 'Standard-Symbol in der Akzentfarbe'
	} as const;
</script>

<div class="aussehen">
	<div class="vorschau" aria-label="Vorschau in Teams">
		<span class="kachel" style:background={vorschauFarbe}>
			<img src={vorschauFarbig ?? aussehen.farbig} alt="" />
		</span>
		<span class="text">
			<strong>{werte.kurzname || aussehen.standard.kurzname}</strong>
			<span>{werte.kurzbeschreibung || aussehen.standard.kurzbeschreibung}</span>
			<span class="klein">{werte.herausgeber || aussehen.standard.herausgeber}</span>
		</span>
		<span class="umriss" title="Umriss-Symbol (Teams-Leiste)">
			<img src={vorschauUmriss ?? aussehen.umriss} alt="" />
		</span>
	</div>

	<form method="POST" action="?/teamsMarke" class="felder" use:enhance={hierBleiben}>
		<div class="zwei">
			<label class="feld">
				<span>Kurzer Name</span>
				<input
					name="kurzname"
					maxlength="30"
					bind:value={werte.kurzname}
					placeholder={aussehen.standard.kurzname}
				/>
				<span class="hinweis">Steht in Teams links in der App-Leiste, höchstens 30 Zeichen.</span>
			</label>
			<label class="feld">
				<span>Langer Name</span>
				<input
					name="langname"
					maxlength="100"
					bind:value={werte.langname}
					placeholder={aussehen.standard.langname}
				/>
			</label>
		</div>
		<label class="feld">
			<span>Kurzbeschreibung</span>
			<input
				name="kurzbeschreibung"
				maxlength="80"
				bind:value={werte.kurzbeschreibung}
				placeholder={aussehen.standard.kurzbeschreibung}
			/>
		</label>
		<label class="feld">
			<span>Beschreibung</span>
			<textarea
				name="langbeschreibung"
				maxlength="4000"
				rows="3"
				bind:value={werte.langbeschreibung}
				placeholder={aussehen.standard.langbeschreibung}></textarea>
		</label>
		<div class="zwei">
			<label class="feld">
				<span>Herausgeber</span>
				<input
					name="herausgeber"
					maxlength="32"
					bind:value={werte.herausgeber}
					placeholder={aussehen.standard.herausgeber}
				/>
			</label>
			<label class="feld" for="{uid}-farbe">
				<span>Akzentfarbe</span>
				<span class="farbzeile">
					<input
						id="{uid}-farbe"
						name="farbe"
						maxlength="7"
						bind:value={werte.farbe}
						placeholder="{aussehen.farbe} (Hauptmandant)"
						pattern={'#[0-9a-fA-F]{6}'}
					/>
					<span class="farbfeld" style:background={vorschauFarbe} aria-hidden="true"></span>
				</span>
				<span class="hinweis">Leer lassen für die Farbe des Hauptmandanten.</span>
			</label>
		</div>
		<div class="zeile">
			<button class="knopf" type="submit">Speichern</button>
			<button class="knopf zweit" type="submit" name="zuruecksetzen" value="ja">
				Auf Standard zurücksetzen
			</button>
		</div>
	</form>

	<form
		method="POST"
		action="?/teamsSymbol"
		enctype="multipart/form-data"
		class="felder"
		use:enhance={hochladen}
	>
		<div class="feld">
			<span><strong>Symbol</strong> · jetzt: {QUELLE[aussehen.quelle]}</span>
			<input
				type="file"
				accept="image/png,image/jpeg,image/webp,image/svg+xml"
				onchange={gewaehlt}
			/>
			<span class="hinweis">
				Quadratisch, am besten mit durchsichtigem Hintergrund. Daraus entstehen das farbige Symbol
				(192 × 192) und das Umriss-Symbol (32 × 32, weiß).
			</span>
		</div>
		<div class="feld">
			<span>
				<strong>Umriss-Symbol</strong> (optional) · jetzt: {aussehen.eigenerUmriss
					? 'eigenes'
					: 'Standard-Symbol'}
			</span>
			<input type="file" accept="image/png,image/webp,image/svg+xml" onchange={umrissGewaehlt} />
			<span class="hinweis">
				Für die App-Leiste in Teams. Nur die deckenden Stellen zählen, Teams zeigt sie in Weiß. Am
				besten ein schlichtes Symbol mit kräftigen Linien auf durchsichtigem Hintergrund; feine
				Details gehen bei 32 × 32 Pixeln verloren.
			</span>
		</div>
		{#if symbolHinweis}<p class="hinweis">{symbolHinweis}</p>{/if}
		{#if symbolFehler}<p class="meldung fehler" role="alert">{symbolFehler}</p>{/if}
		<div class="zeile">
			<button class="knopf" type="submit" disabled={!neuFarbig && !neuUmriss}>
				Symbol speichern
			</button>
			{#if aussehen.quelle === 'eigen' || aussehen.eigenerUmriss}
				<button class="knopf zweit" type="submit" name="zuruecksetzen" value="ja">
					Eigene Symbole entfernen
				</button>
			{/if}
		</div>
	</form>
</div>

<style>
	.aussehen {
		display: grid;
		gap: 16px;
	}
	.vorschau {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px;
		border-radius: 14px;
		background: #f5f5f5;
		color: #242424;
		border: 1px solid var(--bd);
	}
	.kachel {
		flex: none;
		width: 64px;
		height: 64px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.kachel img {
		width: 64px;
		height: 64px;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.klein {
		font-size: 12px;
		color: #616161;
	}
	.umriss {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 8px;
		background: #292929;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.umriss img {
		width: 32px;
		height: 32px;
	}
	.zwei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
		align-items: start;
		gap: 12px;
	}
	.farbzeile {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.farbzeile input {
		flex: 1;
	}
	.farbfeld {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		border: 1px solid var(--bd);
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
</style>
