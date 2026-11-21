/**
 * Bildschirmfoto für Fehlermeldungen, ganz im Browser: aufnehmen (nur am PC
 * im Browser), auswählen oder einfügen; danach zu einem JPEG verkleinert,
 * das höchstens etwa 150 KB groß ist.
 */
const ZIEL = 150 * 1024;

async function verkleinere(
	quelle: CanvasImageSource,
	breite: number,
	hoehe: number
): Promise<Blob> {
	let faktor = Math.min(1, 1600 / breite, 1600 / hoehe);
	for (let versuch = 0; versuch < 8; versuch++) {
		const flaeche = document.createElement('canvas');
		flaeche.width = Math.max(1, Math.round(breite * faktor));
		flaeche.height = Math.max(1, Math.round(hoehe * faktor));
		const stift = flaeche.getContext('2d');
		if (!stift) break;
		stift.fillStyle = '#fff';
		stift.fillRect(0, 0, flaeche.width, flaeche.height);
		stift.drawImage(quelle, 0, 0, flaeche.width, flaeche.height);
		for (const guete of [0.8, 0.6, 0.45]) {
			const blob = await new Promise<Blob | null>((ok) => flaeche.toBlob(ok, 'image/jpeg', guete));
			if (blob && blob.size <= ZIEL) return blob;
		}
		faktor *= 0.75;
	}
	throw new Error('Das Bild lässt sich nicht klein genug machen.');
}

/** Bild aus einer Datei oder der Zwischenablage */
export async function bildAusDatei(datei: Blob): Promise<Blob> {
	if (!datei.type.startsWith('image/'))
		throw new Error('Bitte ein Bild wählen (zum Beispiel ein Bildschirmfoto).');
	let bild: ImageBitmap;
	try {
		bild = await createImageBitmap(datei);
	} catch {
		throw new Error('Dieses Bild lässt sich nicht lesen. Bitte ein PNG- oder JPEG-Bild wählen.');
	}
	try {
		return await verkleinere(bild, bild.width, bild.height);
	} finally {
		bild.close();
	}
}

/** Aufnehmen geht nur am PC im Browser; Handys, Tablets und Teams bieten das nicht an. */
export function kannAufnehmen(inTeams: boolean): boolean {
	return (
		!inTeams &&
		typeof navigator !== 'undefined' &&
		typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
		!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
	);
}

/** Der Browser fragt, welches Fenster er zeigen darf; dieses ist vorgeschlagen. */
export async function nimmAuf(): Promise<Blob> {
	const strom = await navigator.mediaDevices.getDisplayMedia({
		video: true,
		audio: false,
		preferCurrentTab: true
	} as DisplayMediaStreamOptions);
	try {
		const film = document.createElement('video');
		film.muted = true;
		film.srcObject = strom;
		await film.play();
		// Warten, bis der Auswahldialog des Browsers weg ist
		await new Promise((r) => setTimeout(r, 500));
		return await verkleinere(film, film.videoWidth, film.videoHeight);
	} finally {
		for (const spur of strom.getTracks()) spur.stop();
	}
}
