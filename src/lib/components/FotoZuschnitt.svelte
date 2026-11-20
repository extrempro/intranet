<script lang="ts">
	/**
	 * Profilfoto wählen und quadratisch zuschneiden (Kap. 8.13). Der Ausschnitt
	 * wird im Browser auf höchstens 512 px verkleinert und als JPEG geschickt;
	 * der Server prüft es und entfernt Metadaten.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';

	let { aktion = '?/foto' }: { aktion?: string } = $props();

	const RAHMEN = 280;
	const ZIEL = 512;
	const MIN = 128;

	let bild = $state<HTMLImageElement | null>(null);
	let url = $state<string | null>(null);
	let zoom = $state(1);
	let cx = $state(0);
	let cy = $state(0);
	let fehler = $state('');
	let formular: HTMLFormElement | undefined = $state();
	let blob: Blob | null = null;
	let ziehen: { x: number; y: number } | null = null;

	const w = $derived(bild?.naturalWidth ?? 0);
	const h = $derived(bild?.naturalHeight ?? 0);
	const scale = $derived(bild ? (RAHMEN / Math.min(w, h)) * zoom : 1);
	const seite = $derived(RAHMEN / scale);

	function begrenzen() {
		if (!bild) return;
		const half = seite / 2;
		cx = Math.min(Math.max(cx, half), w - half);
		cy = Math.min(Math.max(cy, half), h - half);
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
			if (Math.min(img.naturalWidth, img.naturalHeight) < MIN) {
				fehler = `Das Bild ist zu klein (mindestens ${MIN} × ${MIN} Pixel).`;
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
		const groesse = Math.max(MIN, Math.min(ZIEL, Math.round(seite)));
		const canvas = document.createElement('canvas');
		canvas.width = groesse;
		canvas.height = groesse;
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bild, cx - seite / 2, cy - seite / 2, seite, seite, 0, 0, groesse, groesse);
		blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.88));
		if (!blob) {
			fehler = 'Das Foto konnte nicht vorbereitet werden.';
			return;
		}
		formular?.requestSubmit();
	}

	const absenden: SubmitFunction = ({ formData, cancel }) => {
		if (!blob) return cancel();
		formData.set('foto', blob, 'profilfoto.jpg');
		return async ({ update, result }) => {
			await update();
			if (result.type === 'success') abbrechen();
		};
	};

	function abbrechen() {
		if (url) URL.revokeObjectURL(url);
		url = null;
		bild = null;
		blob = null;
	}
</script>

<div class="stapel">
	<label class="feld">
		<span>{bild ? 'Anderes Bild wählen' : 'Bild wählen'}</span>
		<input type="file" accept="image/jpeg,image/png,image/webp" onchange={waehlen} />
	</label>
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}

	{#if bild && url}
		<p class="hinweis" id="zuschnitt-hilfe">
			Ziehe das Bild in den Kreis und stelle die Größe ein. Mit der Tastatur: Pfeiltasten
			verschieben, + und − vergrößern.
		</p>
		<!-- Verschiebbarer Ausschnitt: per Maus/Finger und Pfeiltasten bedienbar, daher fokussierbar -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="rahmen"
			style:width="{RAHMEN}px"
			style:height="{RAHMEN}px"
			role="application"
			tabindex="0"
			aria-label="Ausschnitt für das Profilfoto"
			aria-describedby="zuschnitt-hilfe"
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
				style:left="{RAHMEN / 2 - cx * scale}px"
				style:top="{RAHMEN / 2 - cy * scale}px"
			/>
			<span class="kreis" aria-hidden="true"></span>
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
			use:enhance={absenden}
		>
			<div class="aktionen">
				<button class="knopf" type="button" onclick={speichern}>Foto speichern</button>
				<button class="linkknopf" type="button" onclick={abbrechen}>Abbrechen</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.rahmen {
		position: relative;
		overflow: hidden;
		border-radius: 14px;
		background: #222;
		touch-action: none;
		cursor: grab;
		user-select: none;
	}
	.rahmen:active {
		cursor: grabbing;
	}
	.rahmen img {
		position: absolute;
		max-width: none;
		pointer-events: none;
	}
	.kreis {
		position: absolute;
		inset: 0;
		border-radius: 999px;
		box-shadow: 0 0 0 999px rgb(0 0 0 / 0.45);
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
