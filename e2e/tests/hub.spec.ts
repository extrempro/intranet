import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler, nichtZuBreit } from './helpers';

test('Hub-Team pflegt den Hub auf einer Seite', async ({ page }, info) => {
	const kurz = `Proben und Auftritte (${info.project.name} ${info.retry})`;
	await anmelden(page, 'hanna');
	await page.goto('/hubs/chor/bearbeiten');
	await expect(page.getByRole('heading', { level: 1, name: /Chor bearbeiten/ })).toBeVisible();
	await keineA11yFehler(page);
	await nichtZuBreit(page);

	await page.getByRole('textbox', { name: /Aufgaben in einer Zeile/ }).fill(kurz);

	// Person suchen und Schreibrechte geben
	const schreiben = page.locator('section', {
		has: page.getByRole('heading', { name: /Wer darf schreiben/ })
	});
	const zeile = schreiben.getByRole('group', { name: 'Schreibrechte von Nils Normal' });
	// Projekte (pc, tablet, handy) laufen nacheinander auf derselben Datenbank
	if ((await zeile.count()) === 0) {
		await schreiben.getByRole('combobox', { name: 'Person suchen' }).fill('Nils');
		await schreiben.getByRole('option', { name: /Nils Normal/ }).click();
		await schreiben.getByRole('button', { name: 'Hinzufügen' }).click();
	}
	await expect(zeile).toBeVisible();
	const faq = zeile.getByRole('button', { name: 'FAQs für Nils Normal' });
	if ((await faq.getAttribute('aria-pressed')) !== 'true') await faq.click();
	await expect(zeile.getByRole('button', { name: 'FAQs für Nils Normal' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Schnellzugriff mit „Ziel wählen“
	const schnell = page.locator('section', {
		has: page.getByRole('heading', { name: 'Schnellzugriff' })
	});
	await schnell.getByRole('button', { name: 'Schnellzugriff hinzufügen' }).click();
	const ziel = page.getByRole('dialog', { name: 'Ziel wählen' });
	await expect(ziel).toBeVisible();
	await ziel.getByLabel('Seite im Intranet oder Dokument').selectOption({ label: 'Kalender' });
	await ziel.getByRole('button', { name: 'Übernehmen' }).click();
	await schnell.getByRole('textbox', { name: 'Kurzbeschreibung' }).last().fill('Alle Termine');

	await page.getByRole('button', { name: 'Speichern', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Gespeichert.' })).toBeVisible();

	await page.goto('/hubs/chor');
	await expect(page.getByText(kurz)).toBeVisible();
	await expect(page.getByRole('link', { name: /Kalender/ }).first()).toBeVisible();
	await keineA11yFehler(page);
	await nichtZuBreit(page);
});

test('Hub-Liste: Suche filtert', async ({ page }) => {
	await anmelden(page, 'nils');
	await page.goto('/hubs');
	await page.getByRole('searchbox', { name: 'Hubs durchsuchen' }).fill('Lauf');
	await expect(page.getByRole('link', { name: 'Laufgruppe' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Chor' })).toHaveCount(0);
});

test('Hub-Seite: Reiter sind eigene Unterseiten, leere zeigen einen Platzhalter', async ({
	page
}) => {
	await anmelden(page, 'hanna');
	await page.goto('/hubs/chor');
	const reiter = page.getByRole('navigation', { name: 'Bereiche von Chor' });
	await expect(reiter.getByRole('link', { name: 'Überblick' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await reiter.getByRole('link', { name: /Über uns & Team/ }).click();
	await expect(page).toHaveURL(/\/hubs\/chor\/team$/);
	await expect(page.getByRole('heading', { name: 'Hub-Team' })).toBeVisible();
	await keineA11yFehler(page);

	// Leerer Bereich: Platzhalter, für das Hub-Team mit Knopf
	await page.goto('/hubs/chor/dokumente');
	await expect(page.getByText('Noch keine Dokumente')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Erstes Dokument anlegen' })).toBeVisible();
	await keineA11yFehler(page);
	await nichtZuBreit(page);
});
