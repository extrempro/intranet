<script lang="ts">
	/**
	 * PDF direkt anzeigen (Kap. 3.3, 8.6): Seiten blättern, Zoom −/+, Einpassen.
	 * Rendert mit pdf.js in ein Canvas; der Worker kommt von der eigenen Herkunft.
	 */
	import { onDestroy, onMount } from 'svelte';
	import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

	let { src, titel, download }: { src: string; titel: string; download: string } = $props();

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
		<span class="gruppe">
			<button
				type="button"
				class="tb"
				aria-label="Vorige Seite"
				disabled={seite <= 1 || !seiten}
				onclick={() => gehe(seite - 1)}
			>
				‹
			</button>
			<span aria-live="polite">{seiten ? `Seite ${seite} / ${seiten}` : ''}</span>
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
			<span aria-live="polite">{aktuellerZoom}</span>
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
				Einpassen
			</button>
		</span>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Adresse kommt bereits über resolve() -->
		<a class="knopf zweit" href={download} download>Herunterladen</a>
	</div>

	<div class="flaeche" bind:this={flaeche}>
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
	<p class="hinweis">
		Wie barrierefrei ein PDF ist, hängt von der Quelle ab. Für Bildschirmleser die Datei
		herunterladen.
	</p>
</div>

<style>
	.pdf {
		display: grid;
		gap: 10px;
	}
	.leiste {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 18px;
		align-items: center;
	}
	.gruppe {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.tb {
		min-width: 44px;
		height: 44px;
		border-radius: 10px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		font-size: 20px;
		cursor: pointer;
	}
	.tb.breit {
		font-size: 14px;
		padding: 0 12px;
	}
	.tb[aria-pressed='true'] {
		background: var(--tint);
		color: var(--ac);
		border-color: var(--ac);
	}
	.tb:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.flaeche {
		overflow: auto;
		max-height: 80vh;
		background: var(--bg);
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 0;
	}
	canvas {
		display: block;
		margin: 0 auto;
		background: #fff;
	}
	.versteckt {
		display: none;
	}
</style>
