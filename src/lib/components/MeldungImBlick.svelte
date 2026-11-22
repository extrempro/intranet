<script lang="ts">
	/**
	 * Design-Regel (Kap. 6.6): Rückmeldungen wie „Gespeichert.“ oder Fehler sind
	 * immer zu sehen. Erscheint eine Meldung (`.meldung` mit role="status" oder
	 * role="alert") außerhalb des sichtbaren Bereichs, zeigt diese Leiste sie
	 * zusätzlich unten im Fenster an (PC, Tablet, Handy). Die Meldung selbst
	 * bleibt die Live-Region für Screenreader; die Leiste wird nicht noch einmal
	 * vorgelesen.
	 */
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';

	let { bereich }: { bereich: () => HTMLElement | undefined } = $props();

	let text = $state('');
	let art = $state<'ok' | 'fehler' | 'warnung'>('ok');
	/** Abstand unten: über der Leiste unten (Handy), sonst 24 px */
	let abstand = $state(24);
	let quelle: HTMLElement | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let sicht: IntersectionObserver | undefined;

	const SELEKTOR = '.meldung[role="status"], .meldung[role="alert"]';

	function schliessen() {
		text = '';
		quelle = null;
		clearTimeout(timer);
		sicht?.disconnect();
	}

	/** Sichtbar heißt: nicht unter der Kopfzeile und nicht unter der Leiste unten */
	function imBlick(el: HTMLElement): boolean {
		const r = el.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) return true; // versteckt: nichts tun
		const oben = document.querySelector('.kopf')?.getBoundingClientRect().bottom ?? 0;
		const leiste = document.querySelector<HTMLElement>('nav.unten');
		const unten =
			leiste && getComputedStyle(leiste).display !== 'none'
				? leiste.getBoundingClientRect().top
				: window.innerHeight;
		return r.top >= oben && r.bottom <= unten;
	}

	function pruefen(el: HTMLElement) {
		if (el.closest('dialog, [role="dialog"], [role="alertdialog"]')) return;
		const inhalt = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
		if (!inhalt || imBlick(el)) return;
		quelle = el;
		text = inhalt;
		const leiste = document.querySelector<HTMLElement>('nav.unten');
		abstand =
			leiste && getComputedStyle(leiste).display !== 'none'
				? window.innerHeight - leiste.getBoundingClientRect().top + 12
				: 24;
		art = el.classList.contains('fehler')
			? 'fehler'
			: el.classList.contains('warnung')
				? 'warnung'
				: 'ok';
		clearTimeout(timer);
		// Erfolgsmeldungen verschwinden von selbst, Fehler erst beim Schließen
		if (art === 'ok') timer = setTimeout(schliessen, 6000);
		// Scrollt man zur Meldung, wird die Leiste überflüssig
		sicht?.disconnect();
		sicht = new IntersectionObserver((e) => {
			if (e.some((x) => x.isIntersecting) && quelle && imBlick(quelle)) schliessen();
		});
		sicht.observe(el);
	}

	function zeigen() {
		const el = quelle;
		schliessen();
		el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	onMount(() => {
		const wurzel = bereich();
		if (!wurzel) return;
		const beobachter = new MutationObserver((liste) => {
			const neu: HTMLElement[] = [];
			for (const m of liste) {
				const ziel = m.target instanceof HTMLElement ? m.target : m.target.parentElement;
				const in_meldung = ziel?.closest<HTMLElement>(SELEKTOR);
				if (in_meldung) neu.push(in_meldung);
				for (const n of m.addedNodes) {
					if (!(n instanceof HTMLElement)) continue;
					if (n.matches(SELEKTOR)) neu.push(n);
					n.querySelectorAll<HTMLElement>(SELEKTOR).forEach((x) => neu.push(x));
				}
			}
			// Die zuletzt erschienene Meldung zählt
			const letzte = neu.pop();
			if (letzte) requestAnimationFrame(() => pruefen(letzte));
		});
		beobachter.observe(wurzel, { childList: true, subtree: true, characterData: true });
		return () => {
			beobachter.disconnect();
			sicht?.disconnect();
			clearTimeout(timer);
		};
	});

	// Ohne JavaScript abgeschickt (Seite neu geladen): Ergebnis der Aktion prüfen
	afterNavigate(() => {
		schliessen();
		if (!page.form) return;
		requestAnimationFrame(() => {
			const alle = bereich()?.querySelectorAll<HTMLElement>(SELEKTOR);
			const letzte = alle?.[alle.length - 1];
			if (letzte) pruefen(letzte);
		});
	});
</script>

{#if text}
	<div class="meldungsleiste {art}" style:bottom="{abstand}px">
		<button type="button" class="text" onclick={zeigen} title="Zur Meldung springen">
			{text}
		</button>
		<button type="button" class="zu" onclick={schliessen} aria-label="Meldung schließen">×</button>
	</div>
{/if}

<style>
	.meldungsleiste {
		position: fixed;
		z-index: 40;
		right: 24px;
		width: min(440px, calc(100vw - 32px));
		display: flex;
		align-items: flex-start;
		gap: 4px;
		padding: 4px;
		border-radius: 12px;
		border: 1px solid var(--bd);
		background: var(--ok-bg);
		color: var(--tx);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
	}
	.meldungsleiste.fehler {
		background: var(--err-bg);
		border-color: var(--err-bd);
		color: var(--err-tx);
	}
	.meldungsleiste.warnung {
		background: var(--warn-bg);
		border-color: var(--warn-bd);
		color: var(--warn-tx);
	}
	.text {
		flex: 1;
		min-height: 44px;
		padding: 8px 10px;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.zu {
		min-width: 44px;
		min-height: 44px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font-size: 22px;
		line-height: 1;
		cursor: pointer;
	}
	.zu:hover,
	.text:hover {
		background: rgb(0 0 0 / 0.05);
	}
	/* Handy: über der Leiste unten, volle Breite */
	@media (max-width: 599px) {
		.meldungsleiste {
			left: 12px;
			right: 12px;
			width: auto;
		}
	}
</style>
