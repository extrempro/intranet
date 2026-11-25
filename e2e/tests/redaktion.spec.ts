import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler, nichtZuBreit, freigeben } from './helpers';

test('Redaktion schreibt für eine Abteilung ohne Pflege an einen anderen Mandanten', async ({
	page
}, info) => {
	const titel = `Hinweis aus dem Lager (${info.project.name} ${info.retry})`;
	await anmelden(page, 'rita');
	await page.goto('/neuigkeiten/neu');
	// Erst nach dem Laden der Seite wählen, sonst setzt sie den Absender zurück
	await expect(async () => {
		await page.getByLabel('Absender').selectOption({ label: 'Lager (Abteilung)' });
		await expect(page.getByRole('checkbox', { name: 'Beispielhaus' })).toBeChecked({
			timeout: 1000
		});
	}).toPass();
	const wer = page.getByRole('group', { name: /Wer sieht das/ });
	await wer.getByRole('radio', { name: 'Nur ausgewählte Mandanten' }).check();
	await wer.getByRole('checkbox', { name: 'Beispielhaus' }).uncheck();
	await wer.getByRole('checkbox', { name: 'Zweithaus' }).check();
	await page.getByLabel('Titel').fill(titel);
	await page.getByRole('textbox', { name: 'Text' }).click();
	await page.keyboard.type('Bitte die Lieferzeiten beachten.');
	await keineA11yFehler(page);
	await freigeben(page);
	await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible();
	const adresse = page.url();

	// Bea aus dem Zweithaus sieht den Beitrag, ohne Link auf die fremde Abteilungsseite
	await anmelden(page, 'bea');
	await page.goto(adresse);
	await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible();
	await expect(page.getByText('Lager', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Lager' })).toHaveCount(0);

	// Aufräumen: Rita löscht ihn wieder
	await anmelden(page, 'rita');
	await page.goto(adresse);
	await page.getByRole('button', { name: 'Löschen' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click();
	await expect(page).toHaveURL(/\/neuigkeiten$/);
});

test('Redaktion: Arbeitsliste und Themen', async ({ page }) => {
	await anmelden(page, 'rita');
	await page.goto('/redaktion');
	await expect(page.getByRole('heading', { name: 'Themen-Vorschläge' })).toBeVisible();
	await keineA11yFehler(page);
	await nichtZuBreit(page);
	await page.getByRole('link', { name: 'Themen pflegen' }).click();
	await expect(page).toHaveURL(/\/redaktion\/themen$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Themen' })).toBeVisible();
	await keineA11yFehler(page);
	await nichtZuBreit(page);
});

test('ohne Redaktion keine Themenpflege', async ({ page }) => {
	await anmelden(page, 'nils');
	expect((await page.goto('/redaktion/themen'))?.status()).toBe(403);
});
