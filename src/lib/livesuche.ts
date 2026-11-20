/**
 * Suchfeld filtert beim Tippen (Entwurf): nach einer kurzen Pause wird das
 * GET-Formular abgeschickt. Fokus und Scrollstand bleiben (data-sveltekit-*
 * am Formular), Enter funktioniert weiterhin.
 */
export function livesuche(input: HTMLInputElement, pause = 350) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let letzter = input.value;
	function eingabe() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (input.value === letzter) return;
			letzter = input.value;
			input.form?.requestSubmit();
		}, pause);
	}
	input.addEventListener('input', eingabe);
	return {
		destroy() {
			clearTimeout(timer);
			input.removeEventListener('input', eingabe);
		}
	};
}
