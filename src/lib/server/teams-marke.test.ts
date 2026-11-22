import { beforeEach, describe, expect, it, vi } from 'vitest';
import { png } from './png.ts';

const speicher = new Map<string, unknown>();
vi.mock('./settings.ts', () => ({
	getSetting: async (k: string, f: unknown) => (speicher.has(k) ? speicher.get(k) : f),
	setSetting: async (k: string, v: unknown) => void speicher.set(k, v)
}));
let symbolStand: number | null = null;
vi.mock('./tenant-branding.ts', () => ({
	mainBranding: async () => ({
		id: 'haupt',
		accent: '#0f6e56',
		symbolStand,
		datenschutz: null,
		impressum: null
	})
}));
const mandantSymbol = png(192, () => [1, 2, 3, 255]);
vi.mock('./marke.ts', async (orig) => ({
	...(await orig<typeof import('./marke.ts')>()),
	readImage: async () => ({ data: mandantSymbol, updatedAt: new Date() })
}));

const { getTeamsMarke, saveTeamsMarke, saveTeamsSymbole, teamsAppAussehen, TeamsMarkeError } =
	await import('./teams-marke.ts');

beforeEach(() => {
	speicher.clear();
	symbolStand = null;
});

describe('Aussehen der Teams-App', () => {
	it('ohne Angaben: Standardtexte, Farbe und Symbol vom Hauptmandanten bzw. Standard', async () => {
		expect((await getTeamsMarke()).kurzname).toBe('Intranet');
		const a = await teamsAppAussehen();
		expect(a.marke.farbe).toBe('#0F6E56');
		expect(a.quelle).toBe('standard');
		symbolStand = 1;
		const b = await teamsAppAussehen();
		expect(b.quelle).toBe('mandant');
		expect(b.farbig).toEqual(mandantSymbol);
	});

	it('speichert eigene Angaben; leere Felder fallen auf den Standard zurück', async () => {
		await saveTeamsMarke({ kurzname: '  Haus A  ', herausgeber: '', farbe: '#a1b2c3' }, 'p');
		const m = await getTeamsMarke();
		expect(m).toMatchObject({ kurzname: 'Haus A', herausgeber: 'IT', farbe: '#A1B2C3' });
		expect((await teamsAppAussehen()).marke.farbe).toBe('#A1B2C3');
	});

	it('lehnt zu lange Namen und ungültige Farben ab', async () => {
		await expect(saveTeamsMarke({ kurzname: 'x'.repeat(31) }, 'p')).rejects.toThrow(
			TeamsMarkeError
		);
		await expect(saveTeamsMarke({ farbe: 'grün' }, 'p')).rejects.toThrow(/#RRGGBB/);
	});

	it('Symbole nur als PNG in der richtigen Größe', async () => {
		const farbig = png(192, () => [9, 9, 9, 255]);
		const umriss = png(32, () => [255, 255, 255, 255]);
		await saveTeamsSymbole(farbig, umriss, 'p');
		const a = await teamsAppAussehen();
		expect(a.quelle).toBe('eigen');
		expect(a.eigenerUmriss).toBe(true);
		await expect(
			saveTeamsSymbole(
				png(100, () => [0, 0, 0, 255]),
				null,
				'p'
			)
		).rejects.toThrow(/192 × 192/);
		await expect(saveTeamsSymbole(farbig, farbig, 'p')).rejects.toThrow(/32 × 32/);
	});

	it('nur ein neuer Umriss behält das farbige Symbol; neues farbiges ohne Umriss setzt ihn zurück', async () => {
		const farbig = png(192, () => [9, 9, 9, 255]);
		const umriss = png(32, () => [255, 255, 255, 255]);
		await saveTeamsSymbole(farbig, null, 'p');
		expect((await teamsAppAussehen()).eigenerUmriss).toBe(false);
		await saveTeamsSymbole(null, umriss, 'p');
		const a = await teamsAppAussehen();
		expect(a.quelle).toBe('eigen');
		expect(a.farbig).toEqual(Buffer.from(farbig));
		expect(a.eigenerUmriss).toBe(true);
		await saveTeamsSymbole(farbig, null, 'p');
		expect((await teamsAppAussehen()).eigenerUmriss).toBe(false);
		await expect(saveTeamsSymbole(null, null, 'p')).rejects.toThrow(TeamsMarkeError);
	});

	it('eigener Umriss auch zum Symbol des Hauptmandanten', async () => {
		symbolStand = 1;
		await saveTeamsSymbole(
			null,
			png(32, () => [255, 255, 255, 255]),
			'p'
		);
		const a = await teamsAppAussehen();
		expect(a.quelle).toBe('mandant');
		expect(a.eigenerUmriss).toBe(true);
	});
});
