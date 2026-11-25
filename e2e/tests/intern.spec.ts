import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler, nichtZuBreit } from './helpers';

test('Nur für unser Team: Prüfdialog, Reiter „Intern“ und Schild nur für das Team', async ({
	page
}, info) => {
	const titel = `Dienstplan IT ${info.project.name} ${Date.now()}`;
	await anmelden(page, 'ada');
	await page.goto('/abteilungen/it/intern');
	await expect(page.getByRole('heading', { level: 1, name: 'IT' })).toBeVisible();
	await keineA11yFehler(page);
	await page.getByRole('link', { name: 'Internen Beitrag schreiben' }).first().click();

	const fuer = page.getByRole('group', { name: 'Für wen?' });
	await expect(fuer.getByRole('radio', { name: 'Nur für unser Team' })).toBeChecked();
	await fuer.getByRole('radio', { name: 'Alle Mitglieder' }).check();
	await page.getByLabel('Titel').fill(titel);
	await page.getByRole('textbox', { name: 'Text' }).click();
	await page.keyboard.type('Bitte tragt euch bis Freitag ein.');
	await nichtZuBreit(page);

	// Prüfdialog nennt das Team; „Zurück“ bleibt im Formular
	await page.getByRole('button', { name: 'Speichern und freigeben' }).click();
	const pruef = page.getByRole('alertdialog', { name: 'Bitte kurz prüfen' });
	await expect(pruef).toContainText('Nur für das Team IT');
	await expect(pruef).toContainText('auch nicht die Redaktion');
	await pruef.getByRole('button', { name: 'Zurück' }).click();
	await expect(page.getByLabel('Titel')).toHaveValue(titel);
	await page.getByRole('button', { name: 'Speichern und freigeben' }).click();
	await pruef.getByRole('button', { name: 'Speichern und freigeben' }).click();
	await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible();
	await expect(page.getByText('Intern · IT').first()).toBeVisible();
	const adresse = page.url();

	// Nils gehört zum Team: Beitrag mit Schild in den Neuigkeiten und im Reiter
	await page.context().clearCookies();
	await anmelden(page, 'nils');
	await page.goto('/neuigkeiten');
	const karte = page.locator('article', { hasText: titel }).first();
	await expect(karte).toBeVisible();
	await expect(karte.getByText('Intern · IT')).toBeVisible();
	await page.goto('/');
	await expect(
		page
			.locator('#bereich-neuigkeiten li, #bereich-neuigkeiten article', { hasText: titel })
			.first()
	).toContainText('Intern · IT');
	await page.goto('/abteilungen/it');
	await page.getByRole('link', { name: 'Intern' }).click();
	await expect(page.getByRole('link', { name: titel })).toBeVisible();

	// Hanna und die Redaktion sehen weder Reiter noch Beitrag
	for (const wer of ['hanna', 'rita'] as const) {
		await page.context().clearCookies();
		await anmelden(page, wer);
		await page.goto('/abteilungen/it');
		await expect(page.getByRole('heading', { level: 1, name: 'IT' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Intern' })).toHaveCount(0);
		expect((await page.goto('/abteilungen/it/intern'))?.status()).toBe(404);
		expect((await page.goto(adresse))?.status()).toBe(404);
		await page.goto('/neuigkeiten');
		await expect(page.locator('article', { hasText: titel })).toHaveCount(0);
	}
});
