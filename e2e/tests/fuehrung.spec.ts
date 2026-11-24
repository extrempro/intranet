import { expect, test, type Page } from '@playwright/test';
import { anmelden } from './helpers';

/** Klickt eine laufende Führung durch und prüft, dass jeder Schritt sichtbar ist. */
async function durchklicken(page: Page, schritte: number, mitZiel: number[]) {
	const kasten = page.getByRole('dialog').filter({ has: page.locator('#tour-titel') });
	for (let i = 1; i <= schritte; i++) {
		await expect(kasten.getByText(new RegExp(`· ${i} von ${schritte}$`))).toBeVisible();
		await expect(kasten).toBeInViewport();
		if (mitZiel.includes(i)) await expect(page.locator('.tour .rahmen')).toBeVisible();
		await kasten.getByRole('button', { name: i === schritte ? 'Fertig' : 'Weiter' }).click();
	}
	await expect(kasten).toHaveCount(0);
}

test('Führung: acht Schritte mit Hervorhebung', async ({ page }) => {
	await anmelden(page, 'nils');
	await page.goto('/?fuehrung=1');
	await durchklicken(page, 8, [2, 3, 4, 5, 6, 7, 8]);
});

test('Einführung Redaktion: alle Schritte mit Ziel', async ({ page }) => {
	await anmelden(page, 'rita');
	await page.goto('/redaktion');
	await page.getByRole('button', { name: 'Einführung: Redaktion' }).click();
	await durchklicken(page, 4, [1, 2, 3, 4]);
});

test('Einführung Neuigkeiten: mit Ziel und Escape beendet', async ({ page }) => {
	await anmelden(page, 'ada');
	await page.goto('/neuigkeiten');
	await page.getByRole('button', { name: 'Einführung: Neuigkeiten' }).click();
	await expect(page.locator('.tour .rahmen')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('.tour')).toHaveCount(0);
});

test('Einführung Mediathek: Suche, Video und Hochladen', async ({ page }) => {
	await anmelden(page, 'hanna');
	await page.goto('/mediathek');
	await page.getByRole('button', { name: 'Einführung: Mediathek' }).click();
	await durchklicken(page, 3, [1, 2, 3]);
});
