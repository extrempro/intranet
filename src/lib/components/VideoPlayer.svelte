<script lang="ts">
	/**
	 * Player der Mediathek (Kap. 8.15): HLS über hls.js (ohne Web Worker),
	 * in Safari nativ. Native Bedienelemente (Tastatur, Vollbild, Untertitel),
	 * dazu ±10 Sekunden und Geschwindigkeit.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { zeitText } from '#lib/mediathek.ts';

	let {
		quelle,
		untertitel = null,
		kapitel = null,
		vorschau = null,
		titel,
		zeit = $bindable(0),
		dauer = $bindable(0),
		start = 0,
		onfortschritt
	}: {
		/** Adresse der master.m3u8 */
		quelle: string;
		untertitel?: string | null;
		kapitel?: string | null;
		vorschau?: string | null;
		titel: string;
		zeit?: number;
		dauer?: number;
		/** Startposition in Sekunden („Weiter, wo du warst“) */
		start?: number;
		/** Stand melden: alle 15 Sekunden beim Abspielen, bei Pause, am Ende und beim Verlassen */
		onfortschritt?: (sek: number, dauer: number, ende: boolean) => void;
	} = $props();

	let video = $state<HTMLVideoElement>();
	let fehler = $state('');
	let tempo = $state(1);
	let hls: { destroy: () => void } | null = null;

	onMount(async () => {
		if (!video) return;
		if (video.canPlayType('application/vnd.apple.mpegurl')) {
			video.src = quelle;
			return;
		}
		const { default: Hls } = await import('hls.js');
		if (!Hls.isSupported()) {
			fehler = 'Dein Browser kann dieses Video nicht abspielen.';
			return;
		}
		const h = new Hls({ enableWorker: false, capLevelToPlayerSize: true });
		h.on(Hls.Events.ERROR, (_e, d) => {
			if (d.fatal)
				fehler = 'Das Video lässt sich gerade nicht laden. Versuch es bitte später noch einmal.';
		});
		h.loadSource(quelle);
		h.attachMedia(video);
		hls = h;
	});
	onDestroy(() => {
		melden(false);
		hls?.destroy();
	});

	let gestartet = false;
	let zuletzt = 0;
	function anfangen() {
		if (gestartet || !video) return;
		gestartet = true;
		if (start > 0 && start < (video.duration || Infinity)) video.currentTime = start;
	}
	function melden(ende: boolean) {
		if (!video || !onfortschritt || !gestartet) return;
		const d = video.duration || 0;
		if (!d) return;
		onfortschritt(ende ? d : video.currentTime, d, ende);
	}
	function weiter() {
		if (!video || video.paused) return;
		if (Math.abs(video.currentTime - zuletzt) >= 15) {
			zuletzt = video.currentTime;
			melden(false);
		}
	}
	function verborgen() {
		if (document.visibilityState === 'hidden') melden(false);
	}

	/** Von außen: an eine Stelle springen und abspielen */
	export function springen(s: number, abspielen = true) {
		if (!video) return;
		video.currentTime = s;
		if (abspielen) void video.play().catch(() => undefined);
	}
	function schritt(d: number) {
		if (video)
			video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + d));
	}
	$effect(() => {
		if (video) video.playbackRate = tempo;
	});
</script>

<svelte:document onvisibilitychange={verborgen} />
<svelte:window onpagehide={() => melden(false)} />

<div class="player">
	<video
		bind:this={video}
		bind:currentTime={zeit}
		bind:duration={dauer}
		controls
		preload="metadata"
		playsinline
		poster={vorschau ?? undefined}
		aria-label={titel}
		onloadedmetadata={anfangen}
		ontimeupdate={weiter}
		onpause={() => melden(false)}
		onended={() => melden(true)}
	>
		{#if untertitel}<track
				kind="subtitles"
				src={untertitel}
				srclang="de"
				label="Deutsch"
				default
			/>{/if}
		{#if kapitel}<track kind="chapters" src={kapitel} srclang="de" label="Kapitel" />{/if}
	</video>
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
	<div class="leiste">
		<span class="zeit" aria-live="off">{zeitText(zeit)} / {zeitText(dauer || 0)}</span>
		<button type="button" class="knopf zweit klein" onclick={() => schritt(-10)}>
			<span aria-hidden="true">−10 s</span><span class="sr-only">10 Sekunden zurück</span>
		</button>
		<button type="button" class="knopf zweit klein" onclick={() => schritt(10)}>
			<span aria-hidden="true">+10 s</span><span class="sr-only">10 Sekunden vor</span>
		</button>
		<label class="tempo">
			<span>Geschwindigkeit</span>
			<select bind:value={tempo}>
				{#each [0.75, 1, 1.25, 1.5, 2] as t (t)}
					<option value={t}>{String(t).replace('.', ',')}×</option>
				{/each}
			</select>
		</label>
	</div>
</div>

<style>
	.player {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	video {
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #0e1311;
		border-radius: 14px;
	}
	.leiste {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.zeit {
		font-variant-numeric: tabular-nums;
		color: var(--mu);
		margin-right: auto;
	}
	.tempo {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
	}
	.tempo select {
		min-height: 40px;
	}
	.klein {
		min-height: 40px;
	}
</style>
