<script lang="ts">
	/**
	 * PDF direkt anzeigen (Kap. 3.3, 8.6): Seiten blättern, Zoom −/+, Einpassen.
	 * Rendert mit pdf.js in ein Canvas; der Worker kommt von der eigenen Herkunft.
	 */
	import { onDestroy, onMount } from 'svelte';
	import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

	let {
		src,
		titel,
		download = '',
		name = ''
	}: {
		src: string;
		titel: string;
		/** Adresse zum Herunterladen; leer = kein Knopf (Seite bietet ihn selbst an) */
		download?: string;
		/** Dateiname links in der Leiste (z. B. beim Speiseplan) */
		name?: string;
	} = $props();

	let flaeche: HTMLDivElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let dokument: PDFDocumentProxy | null = null;
	let ladeaufgabe: PDFDocumentLoadingTask | null = null;
	let aufgabe: RenderTask | null = null;
	let seite = $state(1);
	let seiten = $state(0);
	/** 0 = Einpassen (Breite), sonst Prozent */
	let zoom = $state(0);
	let fehler = $state(false);
	let laedt = $state(true);
	let beobachter: ResizeObserver | null = null;

	onMount(async () => {
		try {
			const pdfjs = await import('pdfjs-dist');
			const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
			pdfjs.GlobalWorkerOptions.workerSrc = worker;
			ladeaufgabe = pdfjs.getDocument({ url: src, withCredentials: true });
			dokument = await ladeaufgabe.promise;
			seiten = dokument.numPages;
			laedt = false;
			await zeichnen();
			beobachter = new ResizeObserver(() => {
				if (zoom === 0) void zeichnen();
			});
			if (flaeche) beobachter.observe(flaeche);
		} catch (err) {
			console.error('PDF konnte nicht angezeigt werden:', err);
			fehler = true;
			laedt = false;
		}
	});

	onDestroy(() => {
		beobachter?.disconnect();
		aufgabe?.cancel();
		void ladeaufgabe?.destroy();
	});

	async function zeichnen() {
		if (!dokument || !canvas || !flaeche) return;
		const page = await dokument.getPage(seite);
		const basis = page.getViewport({ scale: 1 });
		const breite = Math.max(200, flaeche.clientWidth - 2);
		const scale = zoom === 0 ? breite / basis.width : zoom / 100;
		const viewport = page.getViewport({ scale });
		const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.floor(viewport.width * ratio);
		canvas.height = Math.floor(viewport.height * ratio);
		canvas.style.width = `${Math.floor(viewport.width)}px`;
		canvas.style.height = `${Math.floor(viewport.height)}px`;
		aufgabe?.cancel();
		aufgabe = page.render({
			canvas,
			viewport,
			transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined
		});
		try {
			await aufgabe.promise;
		} catch {
			// abgebrochen durch neues Zeichnen
		}
	}

	function gehe(n: number) {
		seite = Math.min(Math.max(1, n), seiten);
		void zeichnen();
	}

	function zoomen(neu: number) {
		zoom = neu;
		void zeichnen();
	}

	const aktuellerZoom = $derived(zoom === 0 ? 'Breite' : `${zoom} %`);
</script>

<div class="pdf">
	<div class="leiste" role="toolbar" aria-label="PDF-Ansicht">
		{#if name}<strong class="name">{name}</strong>{/if}
		<span class="gruppe" class:links={!name}>
			<button
				type="button"
				class="tb"
				aria-label="Vorige Seite"
				disabled={seite <= 1 || !seiten}
				onclick={() => gehe(seite - 1)}
			>
				‹
			</button>
			<span class="wert" aria-live="polite">{seiten ? `${seite} / ${seiten}` : ''}</span>
			<button
				type="button"
				class="tb"
				aria-label="Nächste Seite"
				disabled={seite >= seiten}
				onclick={() => gehe(seite + 1)}
			>
				›
			</button>
		</span>
		<span class="gruppe">
			<button
				type="button"
				class="tb"
				aria-label="Verkleinern"
				disabled={!seiten || (zoom !== 0 && zoom <= 50)}
				onclick={() => zoomen(Math.max(50, (zoom || 100) - 25))}
			>
				−
			</button>
			<span class="wert" aria-live="polite">{aktuellerZoom}</span>
			<button
				type="button"
				class="tb"
				aria-label="Vergrößern"
				disabled={!seiten || zoom >= 300}
				onclick={() => zoomen(Math.min(300, (zoom || 100) + 25))}
			>
				+
			</button>
			<button
				type="button"
				class="tb breit"
				aria-pressed={zoom === 0}
				disabled={!seiten}
				onclick={() => zoomen(0)}
			>
				An Breite anpassen
			</button>
		</span>
		{#if download}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Adresse kommt bereits über resolve() -->
			<a class="knopf zweit klein" href={download} download>Herunterladen</a>
		{/if}
	</div>

	<!-- Scrollbare Fläche per Tastatur erreichbar (Pfeiltasten beim Zoomen) -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="flaeche"
		bind:this={flaeche}
		tabindex="0"
		role="region"
		aria-label="Vorschau: {titel}"
	>
		{#if laedt}<p class="hinweis" role="status">PDF wird geladen …</p>{/if}
		{#if fehler}
			<p class="meldung fehler" role="alert">
				Die Vorschau klappt hier nicht. Lade das PDF bitte herunter.
			</p>
		{/if}
		<div
			role="img"
			aria-label="{titel}, Seite {seite} von {seiten}"
			class:versteckt={laedt || fehler}
		>
			<canvas bind:this={canvas} aria-hidden="true"></canvas>
		</div>
	</div>
</div>
<p class="hinweis fuss">
	Wie barrierefrei ein PDF ist, hängt von der Quelle ab. Für Bildschirmleser die Datei
	herunterladen.
</p>

<style>
	.pdf {
		border: 1px solid var(--bd);
		border-radius: 16px;
		background: var(--sf);
		overflow: hidden;
	}
	.leiste {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		align-items: center;
		justify-content: flex-end;
		padding: 8px 12px;
		border-bottom: 1px solid var(--bd);
	}
	.name {
		margin-right: auto;
		font-size: 14px;
		overflow-wrap: anywhere;
	}
	.gruppe {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.links {
		margin-right: auto;
	}
	.wert {
		min-width: 3.5em;
		text-align: center;
		font-size: 13px;
		color: var(--mu);
	}
	.tb {
		min-width: 36px;
		height: 36px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}
	.tb.breit {
		font-size: 13px;
		font-weight: 600;
		padding: 0 14px;
	}
	.tb[aria-pressed='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.tb:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.klein {
		min-height: 36px;
		padding: 6px 12px;
		font-size: 13px;
	}
	.flaeche {
		overflow: auto;
		max-height: 80vh;
		background: var(--bg);
		padding: 16px;
	}
	canvas {
		display: block;
		margin: 0 auto;
		background: #fff;
		box-shadow: 0 2px 10px rgb(0 0 0 / 0.12);
	}
	.versteckt {
		display: none;
	}
	.fuss {
		margin: 8px 0 0;
	}
</style>
