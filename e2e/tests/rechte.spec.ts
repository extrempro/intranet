import { expect, test } from '@playwright/test';
import { anmelden } from './helpers';

test('ohne Anmeldung geht es zur Anmeldung', async ({ page }) => {
	await page.goto('/neuigkeiten');
	await expect(page).toHaveURL(/\/anmelden/);
});

test('ohne Recht keine Verwaltung und keine Bearbeiten-Seiten', async ({ page }) => {
	// Bea hat nirgends Rechte (Nils bekommt im Hub-Test Schreibrechte)
	await anmelden(page, 'bea');
	for (const pfad of ['/verwaltung', '/hubs/chor/bearbeiten', '/neuigkeiten/neu', '/entwuerfe']) {
		const antwort = await page.goto(pfad);
		expect([403, 404], pfad).toContain(antwort?.status());
	}
	await page.goto('/hubs/chor');
	await expect(page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0);
});

test('Hubs eines anderen Mandanten bleiben verborgen, zentrale nicht', async ({ page }) => {
	await anmelden(page, 'bea');
	expect((await page.goto('/hubs/laufgruppe'))?.status()).toBe(404);
	expect((await page.goto('/hubs/chor'))?.status()).toBe(200);
});
