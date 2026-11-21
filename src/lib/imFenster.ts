/**
 * Aufklapp-Listen (details) im Fenster halten: Steht der Knopf weit rechts,
 * würde die Liste rechts aus dem Bild laufen. Beim Öffnen wird sie so weit
 * nach links verschoben, dass sie mit 8 px Abstand hineinpasst.
 *
 *   <details><summary>…</summary><div class="liste" use:imFenster>…</div></details>
 */
const RAND = 8;

export function imFenster(el: HTMLElement) {
	const details = el.closest('details');
	function anpassen() {
		el.style.translate = '';
		el.style.maxWidth = `calc(100vw - ${2 * RAND}px)`;
		if (details && !details.open) return;
		const r = el.getBoundingClientRect();
		const breite = document.documentElement.clientWidth;
		let dx = 0;
		if (r.right > breite - RAND) dx = breite - RAND - r.right;
		if (r.left + dx < RAND) dx = RAND - r.left;
		if (dx) el.style.translate = `${Math.round(dx)}px 0`;
	}
	details?.addEventListener('toggle', anpassen);
	addEventListener('resize', anpassen);
	anpassen();
	return {
		destroy() {
			details?.removeEventListener('toggle', anpassen);
			removeEventListener('resize', anpassen);
		}
	};
}
