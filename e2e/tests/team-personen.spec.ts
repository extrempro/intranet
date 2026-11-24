import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler, nichtZuBreit } from './helpers';

const IT = '00000000-0000-4000-8000-0000000000a1';

test('Verwaltung: Person live suchen, ins Team holen und wieder entfernen', async ({ page }) => {
	await anmelden(page, 'ada');
	await page.goto(`/verwaltung/abteilungen/${IT}`);
	const team = page.locator('ul.team');
	const hanna = team.locator('li', { hasText: 'Hanna Hub' });

	// Läufe auf derselben Datenbank: ggf. erst entfernen
	if (await hanna.count()) {
		await hanna.getByRole('button', { name: 'Aus dem Team entfernen' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Entfernen' }).click();
		await expect(hanna).toHaveCount(0);
	}

	const suche = page.getByRole('combobox', { name: 'Name oder E-Mail-Adresse' });
	await suche.fill('Hann');
	await expect(page.getByRole('option', { name: /Hanna Hub/ })).toBeVisible();
	// Schon im Team: erscheint nicht
	await suche.fill('Ada');
	await expect(page.getByRole('option', { name: 'Niemand gefunden.' })).toBeVisible();
	// Anderer Mandant: erscheint nicht
	await suche.fill('Bea');
	await expect(page.getByRole('option', { name: 'Niemand gefunden.' })).toBeVisible();

	await suche.fill('Hann');
	await page.getByRole('option', { name: /Hanna Hub/ }).click();
	await keineA11yFehler(page);
	await nichtZuBreit(page);
	await page.getByRole('button', { name: 'Hinzufügen' }).click();
	await expect(hanna).toBeVisible();

	await hanna.getByRole('button', { name: 'Aus dem Team entfernen' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Entfernen' }).click();
	await expect(hanna).toHaveCount(0);
});
