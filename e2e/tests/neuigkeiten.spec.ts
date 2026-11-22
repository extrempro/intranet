import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler } from './helpers';

test('Beitrag schreiben: Entwurf, Rückfrage beim Verlassen, Veröffentlichen', async ({
	page
}, info) => {
	const titel = `Sommerfest ${info.project.name} ${info.retry}`;
	await anmelden(page, 'ada');
	await page.goto('/neuigkeiten/neu');
	await expect(page.getByRole('heading', { level: 1, name: 'Beitrag erstellen' })).toBeVisible();
	await keineA11yFehler(page);

	await page.getByLabel('Titel').fill(titel);
	await page.getByRole('textbox', { name: 'Text' }).click();
	await page.keyboard.type('Das Sommerfest findet im Innenhof statt.');

	// Sofort weg: Rückfrage als eigenes Fenster
	await page.getByRole('link', { name: '← Neuigkeiten' }).click();
	const frage = page.getByRole('alertdialog', { name: 'Seite verlassen?' });
	await expect(frage).toBeVisible();
	await frage.getByRole('button', { name: 'Hierbleiben' }).click();
	await expect(page).toHaveURL(/\/neuigkeiten\/neu/);

	// Entwurf speichert sich von selbst
	await expect(page.getByRole('status').filter({ hasText: 'Entwurf gespeichert' })).toBeVisible({
		timeout: 10_000
	});
	await expect(page).toHaveURL(/entwurf=/);
	const entwurf = new URL(page.url()).searchParams.get('entwurf');

	await page.getByRole('button', { name: 'Speichern und freigeben' }).click();
	await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible();
	await keineA11yFehler(page);

	// Nach dem Veröffentlichen ist der Entwurf weg
	await page.goto('/entwuerfe');
	await expect(page.locator(`a[href*="entwurf=${entwurf}"]`)).toHaveCount(0);
});

test('Lange Liste: Zähler, Monate und Ansicht kompakt bleiben gespeichert', async ({ page }) => {
	await anmelden(page, 'nils');
	await page.goto('/neuigkeiten');
	await expect(page.getByText(/^\d+ von \d+ (Beitrag|Beiträgen)$/)).toBeVisible();
	await expect(page.locator('.monat h2').first()).toContainText(/\d{4}/);
	const kompakt = page.getByRole('button', { name: 'Ansicht: kompakt' });
	await kompakt.click();
	await expect(kompakt).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('article.beitrag.kompakt').first()).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Ansicht: kompakt' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await keineA11yFehler(page);
	await page.getByRole('button', { name: 'Ansicht: ausführlich' }).click();
	await expect(page.locator('article.beitrag.kompakt')).toHaveCount(0);
});
