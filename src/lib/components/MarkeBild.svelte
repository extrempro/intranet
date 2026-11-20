<script lang="ts">
	/**
	 * Logo oder App-Symbol eines Mandanten hochladen. Der Browser rechnet das
	 * Bild (PNG, JPEG, WebP oder SVG) in PNG um: Logos höchstens 1200 × 400,
	 * das App-Symbol quadratisch in 512, 192, 180 und 32 Pixel.
	 */
	import { enhance, type SubmitFunction } from '$app/forms';

	let {
		art,
		titel,
		hinweis,
		bild,
		flaeche
	}: {
		art: 'logo_hell' | 'logo_dunkel' | 'symbol';
		titel: string;
		hinweis: string;
		/** Aktuelles Bild (Adresse) oder null */
		bild: string | null;
		/** Hintergrund der Vorschau */
		flaeche: string;
	} = $props();

	const uid = $props.id();
	let blobs = $state<{ name: string; blob: Blob }[]>([]);
	let vorschau = $state<string | null>(null);
	let fehler = $state('');

	function laden(datei: File): Promise<HTMLImageElement> {
		return new Promise((ok, nein) => {
			const url = URL.createObjectURL(datei);
			const img = new Image();
			img.onload = () => ok(img);
			img.onerror = () => nein(new Error('Das Bild konnte nicht gelesen werden.'));
			img.src = url;
		});
	}

	function png(canvas: HTMLCanvasElement): Promise<Blob> {
		return new Promise((ok, nein) =>
			canvas.toBlob((b) => (b ? ok(b) : nein(new Error('Umrechnen fehlgeschlagen.'))), 'image/png')
		);
	}

	async function gewaehlt(e: Event & { currentTarget: HTMLInputElement }) {
		fehler = '';
		blobs = [];
		vorschau = null;
		const datei = e.currentTarget.files?.[0];
		if (!datei) return;
		if (datei.size > 10_000_000) {
			fehler = 'Die Datei ist zu groß (höchstens 10 MB).';
			return;
		}
		try {
			const img = await laden(datei);
			const w = img.naturalWidth || 512;
			const h = img.naturalHeight || 512;
			if (art === 'symbol') {
				const seite = Math.min(w, h);
				const sx = (w - seite) / 2;
				const sy = (h - seite) / 2;
				const ergebnis: { name: string; blob: Blob }[] = [];
				for (const n of [512, 192, 180, 32]) {
					const c = document.createElement('canvas');
					c.width = n;
					c.height = n;
					const ctx = c.getContext('2d')!;
					ctx.imageSmoothingQuality = 'high';
					ctx.drawImage(img, sx, sy, seite, seite, 0, 0, n, n);
					ergebnis.push({ name: `symbol_${n}`, blob: await png(c) });
				}
				blobs = ergebnis;
			} else {
				const faktor = Math.min(1, 1200 / w, 400 / h);
				const c = document.createElement('canvas');
				c.width = Math.max(16, Math.round(w * faktor));
				c.height = Math.max(16, Math.round(h * faktor));
				const ctx = c.getContext('2d')!;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(img, 0, 0, c.width, c.height);
				blobs = [{ name: art, blob: await png(c) }];
			}
			vorschau = URL.createObjectURL(blobs[0].blob);
		} catch (err) {
			fehler = err instanceof Error ? err.message : 'Das Bild konnte nicht gelesen werden.';
		}
	}

	const hochladen: SubmitFunction = ({ formData, cancel }) => {
		if (blobs.length === 0) return cancel();
		formData.set('art', art);
		for (const b of blobs) formData.set(b.name, b.blob, `${b.name}.png`);
		return async ({ update, result }) => {
			await update({ reset: true });
			if (result.type === 'success') {
				blobs = [];
				vorschau = null;
			}
		};
	};
</script>

<div class="bild">
	<div class="kopf">
		<strong>{titel}</strong>
		<span class="hinweis">{hinweis}</span>
	</div>
	<div class="vorschau" class:symbol={art === 'symbol'} style:background={flaeche}>
		{#if vorschau ?? bild}
			<img src={vorschau ?? bild} alt="Vorschau: {titel}" />
		{:else}
			<span class="leer">Noch kein Bild</span>
		{/if}
	</div>
	<form
		method="POST"
		action="?/bild"
		enctype="multipart/form-data"
		use:enhance={hochladen}
		class="aktionen"
	>
		<label class="knopf zweit klein" for="bild-{uid}">Bild wählen</label>
		<input
			id="bild-{uid}"
			class="sr-only"
			type="file"
			accept="image/png,image/jpeg,image/webp,image/svg+xml"
			onchange={gewaehlt}
		/>
		{#if blobs.length}<button class="knopf klein" type="submit">Speichern</button>{/if}
	</form>
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
	{#if bild && !vorschau}
		<form method="POST" action="?/bildEntfernen" use:enhance>
			<input type="hidden" name="art" value={art} />
			<button class="linkknopf" type="submit">Entfernen</button>
		</form>
	{/if}
</div>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.kopf {
		display: flex;
		flex-direction: column;
	}
	.vorschau {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 88px;
		padding: 12px;
		border: 1px solid var(--bd);
		border-radius: 12px;
	}
	.vorschau img {
		max-width: 100%;
		max-height: 64px;
	}
	.vorschau.symbol img {
		width: 64px;
		height: 64px;
		max-height: none;
		border-radius: 14px;
	}
	.leer {
		font-size: 13px;
		color: #8a938e;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 14px;
		font-size: 14px;
		cursor: pointer;
	}
	label.knopf:has(+ input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
</style>
