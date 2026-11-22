import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler, nichtZuBreit } from './helpers';

// Alle Hauptseiten für eine normale Person: laden, Überschrift, keine
// Barrierefreiheitsfehler (axe-core) und nichts ragt über den Bildschirm.
const SEITEN = [
	'/',
	'/aktuelles',
	'/neuigkeiten',
	'/kalender',
	'/aus-den-hubs',
	'/hinter-den-kulissen',
	'/schwarzes-brett',
	'/speiseplan',
	'/plaene',
	'/organisation',
	'/abteilungen',
	'/abteilungen/it',
	'/hubs',
	'/hubs/chor',
	'/personen',
	'/organigramm',
	'/wissen',
	'/faqs',
	'/mediathek',
	'/mediathek/00000000-0000-4000-8000-0000000000d1',
	'/handbuch',
	'/rechtliches',
	'/neu-im-intranet',
	'/konto',
	'/nachrichten',
	'/benachrichtigungen',
	'/suche?q=Chor'
];

for (const pfad of SEITEN) {
	test(`Seite ${pfad}`, async ({ page }) => {
		await anmelden(page, 'nils');
		const antwort = await page.goto(pfad);
		expect(antwort?.status(), 'HTTP-Status').toBe(200);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await keineA11yFehler(page);
		await nichtZuBreit(page);
	});
}

test('Verwaltung für System-Admins', async ({ page }) => {
	await anmelden(page, 'ada');
	for (const pfad of [
		'/verwaltung',
		'/verwaltung/abteilungen',
		'/verwaltung/benutzer',
		'/verwaltung/regeln',
		'/verwaltung/speicher',
		'/verwaltung/themen'
	]) {
		const antwort = await page.goto(pfad);
		expect(antwort?.status(), pfad).toBe(200);
		await keineA11yFehler(page);
		await nichtZuBreit(page);
	}
});
