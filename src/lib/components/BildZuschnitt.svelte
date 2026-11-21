<script lang="ts">
	/**
	 * Bild wählen und im festen Seitenverhältnis zuschneiden (z. B. Titelbild
	 * 4:1, Symbol 1:1). Der Ausschnitt wird im Browser verkleinert und als JPEG
	 * geschickt; der Server prüft Format und Größe und entfernt Metadaten.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { hierAnwenden } from '#lib/formular.ts';

	let {
		aktion,
		art,
		verhaeltnis = 1,
		minBreite = 128,
		maxBreite = 512,
		beschriftung = 'Bild',
		onfertig
	}: {
		aktion: string;
		/** Wird als Feld „art“ mitgeschickt */
		art: string;
		/** Breite / Höhe */
		verhaeltnis?: number;
		minBreite?: number;
		maxBreite?: number;
		beschriftung?: string;
		onfertig?: () => void;
	} = $props();

	let breiteVerfuegbar = $state(320);
	const RB = $derived(Math.min(verhaeltnis > 1 ? 640 : 280, Math.max(200, breiteVerfuegbar)));
	const RH = $derived(Math.round(RB / verhaeltnis));

	let bild = $state<HTMLImageElement | null>(null);
	let url = $state<string | null>(null);
	let zoom = $state(1);
	let cx = $state(0);
	let cy = $state(0);
	let fehler = $state('');
	let laeuft = $state(false);
	let formular: HTMLFormElement | undefined = $state();
	let blob: Blob | null = null;
	let ziehen: { x: number; y: number } | null = null;

	const w = $derived(bild?.naturalWidth ?? 0);
	const h = $derived(bild?.naturalHeight ?? 0);
	// Ausschnitt deckt den Rahmen immer ganz ab
	const scale = $derived(bild ? Math.max(RB / w, RH / h) * zoom : 1);
	const sw = $derived(RB / scale);
	const sh = $derived(RH / scale);

	function begrenzen() {
		if (!bild) return;
		cx = Math.min(Math.max(cx, sw / 2), w - sw / 2);
		cy = Math.min(Math.max(cy, sh / 2), h - sh / 2);
	}

	function waehlen(e: Event) {
		fehler = '';
		const datei = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!datei) return;
		if (datei.size > 20 * 1024 * 1024) {
			fehler = 'Das Bild ist größer als 20 MB.';
			return;
		}
		if (url) URL.revokeObjectURL(url);
		const neu = URL.createObjectURL(datei);
		const img = new Image();
		img.onload = () => {
			const minH = Math.round(minBreite / verhaeltnis);
			if (img.naturalWidth < minBreite || img.naturalHeight < minH) {
				fehler = `Das Bild ist zu klein (mindestens ${minBreite} × ${minH} Pixel).`;
				URL.revokeObjectURL(neu);
				return;
			}
			url = neu;
			bild = img;
			zoom = 1;
			cx = img.naturalWidth / 2;
			cy = img.naturalHeight / 2;
		};
		img.onerror = () => {
			fehler = 'Dieses Bild kann der Browser nicht öffnen. Bitte JPG, PNG oder WebP wählen.';
			URL.revokeObjectURL(neu);
		};
		img.src = neu;
	}

	function zoomen(z: number) {
		zoom = Math.min(4, Math.max(1, z));
		begrenzen();
	}
	function verschieben(dx: number, dy: number) {
		cx -= dx / scale;
		cy -= dy / scale;
		begrenzen();
	}
	function runter(e: PointerEvent) {
		ziehen = { x: e.clientX, y: e.clientY };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function bewegen(e: PointerEvent) {
		if (!ziehen) return;
		verschieben(e.clientX - ziehen.x, e.clientY - ziehen.y);
		ziehen = { x: e.clientX, y: e.clientY };
	}
	function taste(e: KeyboardEvent) {
		const schritt = e.shiftKey ? 40 : 10;
		const map: Record<string, [number, number]> = {
			ArrowLeft: [schritt, 0],
			ArrowRight: [-schritt, 0],
			ArrowUp: [0, schritt],
			ArrowDown: [0, -schritt]
		};
		if (map[e.key]) {
			e.preventDefault();
			verschieben(...map[e.key]);
		} else if (e.key === '+' || e.key === '=') zoomen(zoom + 0.1);
		else if (e.key === '-') zoomen(zoom - 0.1);
	}

	async function speichern() {
		if (!bild) return;
		const breite = Math.max(minBreite, Math.min(maxBreite, Math.round(sw)));
		const hoehe = Math.round(breite / verhaeltnis);
		const canvas = document.createElement('canvas');
		canvas.width = breite;
		canvas.height = hoehe;
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bild, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, breite, hoehe);
		blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.86));
		if (!blob) {
			fehler = 'Das Bild konnte nicht vorbereitet werden.';
			return;
		}
		formular?.requestSubmit();
	}

	const absenden: SubmitFunction = ({ formData, cancel }) => {
		if (!blob) return cancel();
		laeuft = true;
		formData.set('foto', blob, `${art}.jpg`);
		return async ({ result }) => {
			laeuft = false;
			await hierAnwenden(result);
			if (result.type === 'success') {
				abbrechen();
				onfertig?.();
			}
		};
	};

	function abbrechen() {
		if (url) URL.revokeObjectURL(url);
		url = null;
		bild = null;
		blob = null;
	}
</script>

<div class="stapel" bind:clientWidth={breiteVerfuegbar}>
	<label class="feld">
		<span>{bild ? 'Anderes Bild wählen' : `${beschriftung} wählen`}</span>
		<input type="file" accept="image/jpeg,image/png,image/webp" onchange={waehlen} />
	</label>
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}

	{#if bild && url}
		<p class="hinweis" id="zuschnitt-{art}">
			Verschiebe das Bild im Rahmen und stelle die Größe ein. Mit der Tastatur: Pfeiltasten
			verschieben, + und − vergrößern.
		</p>
		<!-- Verschiebbarer Ausschnitt: per Maus/Finger und Pfeiltasten bedienbar, daher fokussierbar -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="rahmen"
			style:width="{RB}px"
			style:height="{RH}px"
			role="application"
			tabindex="0"
			aria-label="Ausschnitt für {beschriftung}"
			aria-describedby="zuschnitt-{art}"
			onpointerdown={runter}
			onpointermove={bewegen}
			onpointerup={() => (ziehen = null)}
			onpointercancel={() => (ziehen = null)}
			onkeydown={taste}
		>
			<img
				src={url}
				alt=""
				draggable="false"
				style:width="{w * scale}px"
				style:height="{h * scale}px"
				style:left="{RB / 2 - cx * scale}px"
				style:top="{RH / 2 - cy * scale}px"
			/>
		</div>
		<label class="feld zoom">
			<span>Größe</span>
			<input
				type="range"
				min="1"
				max="4"
				step="0.01"
				value={zoom}
				oninput={(e) => zoomen(Number(e.currentTarget.value))}
			/>
		</label>
		<form
			bind:this={formular}
			method="POST"
			action={aktion}
			enctype="multipart/form-data"
			data-ohne-schutz
			use:enhance={absenden}
		>
			<input type="hidden" name="art" value={art} />
			<div class="aktionen">
				<button class="knopf" type="button" onclick={speichern} disabled={laeuft}>
					{beschriftung} speichern
				</button>
				<button class="linkknopf" type="button" onclick={abbrechen}>Abbrechen</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.rahmen {
		position: relative;
		overflow: hidden;
		border-radius: 12px;
		background: #222;
		touch-action: none;
		cursor: grab;
		user-select: none;
		max-width: 100%;
	}
	.rahmen:active {
		cursor: grabbing;
	}
	.rahmen img {
		position: absolute;
		max-width: none;
		pointer-events: none;
	}
	.zoom {
		max-width: 280px;
	}
	.aktionen {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
</style>
