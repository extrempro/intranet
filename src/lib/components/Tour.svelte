<script lang="ts">
	/**
	 * Führung bzw. Einführung (Kap. 13): hebt das Ziel hervor, scrollt es in
	 * den Blick und erklärt es. Tastatur: Pfeiltasten blättern, Escape beendet.
	 * „Bewegung reduzieren“ des Systems schaltet das weiche Scrollen ab.
	 */
	import { tick, untrack } from 'svelte';
	import { hilfe } from '#lib/hilfe.svelte.ts';
	import type { Tour } from '#lib/tours.ts';

	let { tour }: { tour: Tour } = $props();

	let i = $state(0);
	let rahmen = $state<{ top: number; left: number; width: number; height: number } | null>(null);
	let ueberschrift: HTMLHeadingElement | undefined = $state();
	/** Lage des Erklärkastens zum Ziel; „fest“ = unten am Rand, wenn nirgends Platz ist */
	let lage = $state<{
		art: 'unten' | 'oben' | 'rechts' | 'links' | 'fest';
		top: number;
		left: number;
	}>({
		art: 'fest',
		top: 0,
		left: 0
	});
	let kastenHoehe = $state(200);
	const ABSTAND = 12;

	const schritt = $derived(tour.steps[i]);
	const letzter = $derived(i === tour.steps.length - 1);

	function ziel(name?: string): HTMLElement | null {
		if (!name) return null;
		for (const n of name.split(',')) {
			for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${n.trim()}"]`)) {
				if (el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden') return el;
			}
		}
		return null;
	}

	function messen() {
		const el = ziel(schritt?.target);
		if (!el) {
			rahmen = null;
			return;
		}
		const r = el.getBoundingClientRect();
		const pad = 6;
		// Große Ziele nur so weit hervorheben, wie sie im Bild sind
		const oben = Math.max(r.top - pad, 4);
		const unten = Math.min(r.bottom + pad, innerHeight - 4);
		if (unten - oben < 8) {
			rahmen = null;
			return;
		}
		rahmen = { top: oben, left: r.left - pad, width: r.width + pad * 2, height: unten - oben };
		// Erklärung dorthin, wo Platz ist: unter, über, rechts oder links vom Ziel
		const breite = Math.min(360, innerWidth - 24);
		const hoehe = kastenHoehe + ABSTAND;
		const rechts = rahmen.left + rahmen.width;
		const links = Math.max(ABSTAND, Math.min(rahmen.left, innerWidth - breite - ABSTAND));
		const senkrecht = Math.max(ABSTAND, Math.min(oben, innerHeight - kastenHoehe - ABSTAND));
		if (innerHeight - unten >= hoehe + ABSTAND)
			lage = { art: 'unten', top: unten + ABSTAND, left: links };
		else if (oben >= hoehe + ABSTAND) lage = { art: 'oben', top: oben - hoehe, left: links };
		else if (innerWidth - rechts >= breite + 2 * ABSTAND)
			lage = { art: 'rechts', top: senkrecht, left: rechts + ABSTAND };
		else if (rahmen.left >= breite + 2 * ABSTAND)
			lage = { art: 'links', top: senkrecht, left: rahmen.left - breite - ABSTAND };
		else lage = { art: 'fest', top: 0, left: 0 };
	}

	const imBild = (el: HTMLElement) => {
		const r = el.getBoundingClientRect();
		return r.bottom > 0 && r.top < innerHeight;
	};

	async function zeigen() {
		await tick();
		const el = ziel(schritt?.target);
		const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Hohe Ziele mit dem Anfang nach oben, sonst mittig
		const hoch = el ? el.getBoundingClientRect().height > innerHeight * 0.6 : false;
		el?.scrollIntoView({ block: hoch ? 'start' : 'center', behavior: ruhig ? 'auto' : 'smooth' });
		messen();
		setTimeout(
			() => {
				// Wurde das weiche Scrollen unterbrochen (schnelles Weiterklicken), sofort hinspringen
				if (el && !imBild(el)) el.scrollIntoView({ block: hoch ? 'start' : 'center' });
				messen();
			},
			ruhig ? 0 : 400
		);
		ueberschrift?.focus();
	}

	$effect(() => {
		void i;
		void zeigen();
	});

	// Andere Texthöhe: Lage des Kastens neu bestimmen
	$effect(() => {
		void kastenHoehe;
		untrack(messen);
	});

	$effect(() => {
		const neu = () => messen();
		addEventListener('resize', neu);
		addEventListener('scroll', neu, true);
		return () => {
			removeEventListener('resize', neu);
			removeEventListener('scroll', neu, true);
		};
	});

	function weiter() {
		if (letzter) hilfe.beenden();
		else i++;
	}

	function taste(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			hilfe.beenden();
		} else if (e.key === 'ArrowRight') weiter();
		else if (e.key === 'ArrowLeft' && i > 0) i--;
	}

	const position = $derived.by(() => {
		if (!rahmen) return 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
		if (lage.art === 'fest') return `bottom: ${ABSTAND}px; left: 50%; transform: translateX(-50%);`;
		return `top: ${lage.top}px; left: ${lage.left}px;`;
	});
</script>

<svelte:window onkeydown={taste} />

<div class="tour" aria-live="polite">
	<!-- Fängt Klicks ab, damit die Seite während der Führung ruhig bleibt -->
	<div class="schleier" class:dunkel={!rahmen} aria-hidden="true"></div>
	{#if rahmen}
		<div
			class="rahmen"
			aria-hidden="true"
			style:top="{rahmen.top}px"
			style:left="{rahmen.left}px"
			style:width="{rahmen.width}px"
			style:height="{rahmen.height}px"
		></div>
	{/if}
	<div
		class="kasten"
		role="dialog"
		aria-modal="true"
		aria-labelledby="tour-titel"
		aria-describedby="tour-text"
		style={position}
		bind:clientHeight={kastenHoehe}
	>
		<p class="zaehler">{tour.title} · {i + 1} von {tour.steps.length}</p>
		<h2 id="tour-titel" tabindex="-1" bind:this={ueberschrift}>{schritt.title}</h2>
		<p id="tour-text">{schritt.text}</p>
		<div class="knoepfe">
			<button class="linkknopf" type="button" onclick={() => hilfe.beenden()}>
				{letzter ? 'Schließen' : 'Beenden'}
			</button>
			<span class="rechts">
				{#if i > 0}
					<button class="knopf zweit klein" type="button" onclick={() => i--}>Zurück</button>
				{/if}
				<button class="knopf klein" type="button" onclick={weiter}>
					{letzter ? 'Fertig' : 'Weiter'}
				</button>
			</span>
		</div>
	</div>
</div>

<style>
	/* Ziele nicht unter die feste Kopfzeile scrollen */
	:global([data-tour]) {
		scroll-margin-top: 80px;
		scroll-margin-bottom: 24px;
	}
	.tour {
		position: fixed;
		inset: 0;
		z-index: 100;
	}
	.schleier {
		position: fixed;
		inset: 0;
	}
	.schleier.dunkel {
		background: rgb(0 0 0 / 0.45);
	}
	.rahmen {
		position: fixed;
		border-radius: 12px;
		box-shadow:
			0 0 0 3px var(--ac),
			0 0 0 9999px rgb(0 0 0 / 0.45);
		pointer-events: none;
		transition: all 0.2s ease;
	}
	@media (prefers-reduced-motion: reduce) {
		.rahmen {
			transition: none;
		}
	}
	.kasten {
		position: fixed;
		width: min(360px, calc(100vw - 24px));
		box-sizing: border-box;
		background: var(--sf);
		color: var(--tx);
		border: 1px solid var(--bd);
		border-radius: 14px;
		padding: 16px;
		box-shadow: var(--shadow);
		display: grid;
		gap: 8px;
	}
	.zaehler {
		margin: 0;
		font-size: 13px;
		color: var(--mu);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	h2:focus {
		outline: none;
	}
	#tour-text {
		margin: 0;
		line-height: 1.5;
	}
	.knoepfe {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}
	.rechts {
		display: flex;
		gap: 8px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 14px;
		font-size: 14px;
	}
</style>
