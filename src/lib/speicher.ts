/**
 * Inhaltsarten für die Zuordnung zum Speicherort (Verwaltung → Speicher, Kap. 18).
 * Die Art wird beim Ablegen festgelegt und ändert sich danach nicht.
 */
export const KATEGORIEN = [
	{
		key: 'inhalte',
		label: 'Dateien in Inhalten',
		text: 'Anhänge, Bilder im Text, Dokumente der Einheiten, Schwarzes Brett, Rechtliches'
	},
	{ key: 'plaene', label: 'Pläne und Speiseplan', text: 'Pläne, Speiseplan, Organigramm' },
	{
		key: 'bilder',
		label: 'Profilfotos und Bilder der Einheiten',
		text: 'Profilfotos, Titelbilder und Symbole'
	},
	{ key: 'rueckmeldungen', label: 'Bildschirmfotos', text: 'aus Rückmeldungen' },
	{ key: 'videos', label: 'Videos der Mediathek', text: 'umgewandelte Videos und Vorschaubilder' }
] as const;

export type Kategorie = (typeof KATEGORIEN)[number]['key'];

export function istKategorie(v: unknown): v is Kategorie {
	return KATEGORIEN.some((k) => k.key === v);
}

/** Zuordnung Inhaltsart → Speicherort (ID eines S3-Speichers, null = lokal) */
export type Zuordnung = Partial<Record<Kategorie, string | null>>;

/** Prüft einen S3-Endpoint ohne Namensauflösung (die prüft der Server zusätzlich). */
export function endpointFehler(raw: string): string | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return 'Gib eine vollständige Adresse ein, z. B. https://s3.example.org.';
	}
	if (url.protocol !== 'https:') return 'Nur Adressen mit https:// sind erlaubt.';
	if (url.username || url.password) return 'Zugangsdaten gehören nicht in die Adresse.';
	if (url.search || url.hash) return 'Die Adresse darf keine Parameter enthalten.';
	if (url.pathname !== '/' && url.pathname !== '') return 'Gib nur die Adresse ohne Pfad ein.';
	const host = url.hostname.toLowerCase();
	if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost'))
		return 'Interne Adressen sind nicht erlaubt.';
	if (/^[\d.]+$/.test(host) || host.startsWith('['))
		return 'Gib einen Namen statt einer IP-Adresse ein.';
	if (/\.(local|internal|lan|home|intranet|corp)$/.test(host))
		return 'Interne Adressen sind nicht erlaubt.';
	return null;
}

/** Bucket-Namen nach den S3-Regeln (3–63 Zeichen, klein, Ziffern, Punkt, Bindestrich) */
export function bucketFehler(raw: string): string | null {
	const b = raw.trim();
	if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(b) || b.includes('..'))
		return 'Bucket: 3 bis 63 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt und Bindestrich.';
	return null;
}
