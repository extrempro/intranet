import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler, nichtZuBreit, freigeben } from './helpers';

test('Umfrage am Beitrag: anlegen, Pflichtfrage, beantworten, Ergebnis', async ({ page }, info) => {
	const titel = `Mittagessen ${info.project.name} ${info.retry}`;
	await anmelden(page, 'hanna');
	await page.goto('/neuigkeiten/neu?absender=00000000-0000-4000-8000-0000000000b1');
	await page.getByLabel('Titel').fill(titel);
	await page.getByRole('textbox', { name: 'Text' }).click();
	await page.keyboard.type('Wir planen das Essen für den Ausflug.');

	await page.getByRole('button', { name: 'Umfrage hinzufügen' }).click();
	await page.getByLabel('Frage', { exact: true }).fill('Pizza oder Pasta?');
	await page.getByLabel('Antwort 1 zu Frage 1').fill('Pizza');
	await page.getByLabel('Antwort 2 zu Frage 1').fill('Pasta');
	await expect(page.getByRole('heading', { name: 'Wer sieht was?' })).toBeVisible();
	// Nach oben: sonst liegen Felder unter der festen Kopfzeile (axe: target-size)
	await page.evaluate(() => window.scrollTo(0, 0));
	await keineA11yFehler(page);
	await nichtZuBreit(page);
	await freigeben(page);
	await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible();
	await expect(page.getByRole('heading', { name: /Umfrage · Auswahl/ })).toBeVisible();
	const adresse = page.url();

	// Andere Person beantwortet
	await page.context().clearCookies();
	await anmelden(page, 'nils');
	await page.goto(adresse);
	const umfrage = page.getByRole('region', { name: /Umfrage/ });
	await expect(umfrage.getByText('Anonym', { exact: true })).toBeVisible();
	await umfrage.getByText('Wer sieht was?').click();
	await expect(umfrage.getByText(/Niemand kann sie dir zuordnen/)).toBeVisible();
	await keineA11yFehler(page);
	await nichtZuBreit(page);

	await umfrage.getByRole('button', { name: 'Antworten senden' }).click();
	await expect(umfrage.getByText('Bitte beantworte diese Frage.')).toBeVisible();

	await umfrage.getByLabel('Pasta').check();
	await umfrage.getByRole('button', { name: 'Antworten senden' }).click();
	await expect(umfrage.getByText('Danke, deine Antworten sind angekommen.')).toBeVisible();
	await expect(umfrage.getByRole('heading', { name: /Ergebnis · 1 Teilnahme/ })).toBeVisible();
	await expect(umfrage.getByRole('button', { name: 'Antworten ändern' })).toHaveCount(0);
	await keineA11yFehler(page);
});
