/**
 * Animierte Bilder im Text (WCAG 2.2.2): Sie starten angehalten; ein Knopf
 * spielt sie ab bzw. hält sie an. Angehalten liegt ein Standbild (Canvas)
 * über dem Bild; das Bild selbst bleibt mit Beschreibung für Bildschirmleser.
 *
 *   <div class="text" use:animierteBilder>{@html html}</div>
 */
export function animierteBilder(container: HTMLElement) {
	function einrichten(img: HTMLImageElement) {
		if (img.dataset.steuerung) return;
		img.dataset.steuerung = '1';
		const rahmen = document.createElement('span');
		rahmen.className = `animation ${[...img.classList].filter((k) => k.startsWith('bild-')).join(' ')}`;
		img.replaceWith(rahmen);
		rahmen.append(img);
		const standbild = document.createElement('canvas');
		standbild.setAttribute('aria-hidden', 'true');
		const knopf = document.createElement('button');
		knopf.type = 'button';
		knopf.className = 'animation-knopf';
		rahmen.append(standbild, knopf);
		let laeuft = false;
		const zeichnen = () => {
			standbild.width = img.naturalWidth;
			standbild.height = img.naturalHeight;
			standbild.getContext('2d')?.drawImage(img, 0, 0);
		};
		const zeigen = () => {
			rahmen.classList.toggle('laeuft', laeuft);
			knopf.textContent = laeuft ? '❚❚ Anhalten' : '▶ Abspielen';
			knopf.setAttribute(
				'aria-label',
				`${laeuft ? 'Animation anhalten' : 'Animation abspielen'}: ${img.alt}`
			);
		};
		knopf.addEventListener('click', () => {
			if (laeuft) zeichnen();
			else {
				// Von vorn beginnen
				const src = img.src;
				img.src = '';
				img.src = src;
			}
			laeuft = !laeuft;
			zeigen();
		});
		if (img.complete && img.naturalWidth) zeichnen();
		else img.addEventListener('load', zeichnen, { once: true });
		zeigen();
	}
	const alle = () =>
		container.querySelectorAll<HTMLImageElement>('img.bild-animiert').forEach(einrichten);
	alle();
	const beobachter = new MutationObserver(alle);
	beobachter.observe(container, { childList: true, subtree: true });
	return { destroy: () => beobachter.disconnect() };
}
