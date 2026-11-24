import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler, nichtZuBreit } from './helpers';

test('Abteilung wie Hub: Reiter, Schnellzugriff und Aufbau pflegen', async ({ page }, info) => {
	const titel = `Ticket aufgeben (${info.project.name} ${info.retry})`;
	await anmelden(page, 'ada');
	await page.goto('/abteilungen/it/bearbeiten#gestaltung');
	const bereich = page.locator('details#gestaltung');
	await expect(bereich).toHaveAttribute('open', '');

	// Schnellzugriff: Liste leeren, eine Kachel anlegen
	const schnell = bereich.locator('section', {
		has: page.getByRole('heading', { name: 'Schnellzugriff' })
	});
	while ((await schnell.getByRole('button', { name: /entfernen$/ }).count()) > 0)
		await schnell
			.getByRole('button', { name: /entfernen$/ })
			.first()
			.click();
	await schnell.getByRole('button', { name: 'Schnellzugriff hinzufügen' }).click();
	const ziel = page.getByRole('dialog', { name: 'Ziel wählen' });
	await ziel.getByLabel('Seite im Intranet oder Dokument').selectOption({ label: 'Kalender' });
	await ziel.getByRole('button', { name: 'Übernehmen' }).click();
	await schnell.getByRole('textbox', { name: 'Bezeichnung' }).last().fill(titel);

	// Aufbau: „Wer hilft bei was?“ ausblenden
	const wer = bereich.getByRole('switch', { name: 'Wer hilft bei was?' });
	if (await wer.isChecked()) await wer.uncheck();
	await keineA11yFehler(page);
	await nichtZuBreit(page);
	await bereich
		.getByRole('button', { name: 'Aufbau, Schnellzugriff und Dokumente speichern' })
		.click();
	await expect(bereich.getByRole('status').filter({ hasText: 'Gespeichert.' })).toBeVisible();

	await page.goto('/abteilungen/it');
	await expect(page.getByRole('heading', { level: 1, name: 'IT' })).toBeVisible();
	await expect(
		page.getByRole('link', { name: new RegExp(titel.replace(/[()]/g, '.')) })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Wer hilft bei was?' })).toHaveCount(0);
	await keineA11yFehler(page);
	await nichtZuBreit(page);

	// Reiter sind eigene Unterseiten
	await page
		.getByRole('navigation', { name: 'Bereiche von IT' })
		.getByRole('link', { name: 'Über uns & Team' })
		.click();
	await expect(page).toHaveURL(/\/abteilungen\/it\/team$/);
	await expect(page.getByRole('heading', { name: /^Team/ })).toBeVisible();

	// Wieder einschalten für andere Läufe
	await page.goto('/abteilungen/it/bearbeiten#gestaltung');
	await bereich.getByRole('switch', { name: 'Wer hilft bei was?' }).check();
	await bereich
		.getByRole('button', { name: 'Aufbau, Schnellzugriff und Dokumente speichern' })
		.click();
	await expect(bereich.getByRole('status').filter({ hasText: 'Gespeichert.' })).toBeVisible();
});

test('Abteilungen: Übersicht mit Suche, Sortierung und deiner Abteilung', async ({ page }) => {
	await anmelden(page, 'nils');
	await page.goto('/abteilungen');
	await expect(page.getByRole('heading', { name: /Deine Abteilung/ })).toBeVisible();
	await expect(page.getByText('Deine Stammabteilung · Abteilung')).toBeVisible();
	await page.getByRole('button', { name: 'A–Z' }).click();
	await expect(page.getByRole('button', { name: 'A–Z' })).toHaveAttribute('aria-pressed', 'true');
	await page
		.getByRole('searchbox', { name: 'Abteilung, Thema oder Person suchen' })
		.fill('zzz-nichts');
	await expect(page.getByText(/Keine Abteilung gefunden/)).toBeVisible();
	await keineA11yFehler(page);
	await nichtZuBreit(page);
});

test('Recht „Dokumente“: Person pflegt nur die Dokumente der Abteilung', async ({ page }) => {
	const rechtSetzen = async (an: boolean) => {
		await anmelden(page, 'ada');
		await page.goto('/abteilungen/it/bearbeiten');
		await page.getByText(/^Team und Schreibrechte/).click();
		const zeile = page.locator('ul.team > li', { hasText: 'Nils Normal' });
		await zeile.getByRole('checkbox', { name: 'Dokumente', exact: true }).setChecked(an);
		await zeile.getByRole('button', { name: 'Rechte speichern' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Rechte gespeichert.' })).toBeVisible();
	};
	await rechtSetzen(true);
	try {
		await anmelden(page, 'nils');
		await page.goto('/abteilungen/it');
		await page.getByRole('link', { name: 'Dokumente pflegen' }).click();
		await expect(page).toHaveURL(/\/abteilungen\/it\/dokumente-pflegen$/);
		await expect(page.getByRole('heading', { level: 1, name: 'Dokumente von IT' })).toBeVisible();
		// Nur Dokumente, kein Aufbau und kein Schnellzugriff
		await expect(page.getByRole('heading', { name: 'Schnellzugriff' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: /Aufbau der Seite/ })).toHaveCount(0);
		await page.getByRole('button', { name: 'Dokumente speichern' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Gespeichert.' })).toBeVisible();
		await keineA11yFehler(page);
		await nichtZuBreit(page);
		// Die ganze Pflege bleibt verschlossen
		const r = await page.goto('/abteilungen/it/bearbeiten');
		expect(r?.status()).toBe(404);
	} finally {
		await rechtSetzen(false);
	}
});
