import { expect, test } from '@playwright/test';
import { anmelden, keineA11yFehler } from './helpers';

const VIDEO = '00000000-0000-4000-8000-0000000000d1';
const ENTWURF = '00000000-0000-4000-8000-0000000000d2';

test('Mediathek: Video ansehen ohne Bearbeiten, Kapitel sichtbar', async ({ page }) => {
	await anmelden(page, 'nils');
	await page.goto('/mediathek');
	await expect(page.getByRole('link', { name: /Drucker einrichten/ })).toBeVisible();
	await expect(page.getByText('Probe im Entwurf')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Video hochladen' })).toHaveCount(0);
	await page.goto(`/mediathek/${VIDEO}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Drucker einrichten' })).toBeVisible();
	await expect(page.getByRole('button', { name: /Treiber/ })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0);
	expect((await page.goto(`/mediathek/${ENTWURF}`))?.status()).toBe(404);
	expect((await page.goto(`/mediathek/${ENTWURF}/bearbeiten`))?.status()).toBe(403);
	expect((await page.request.get(`/mediathek/${ENTWURF}/medien/master.m3u8`)).status()).toBe(404);
});

test('Mediathek: Einschränkung auf einen Mandanten greift', async ({ page }) => {
	await anmelden(page, 'bea');
	expect((await page.goto(`/mediathek/${VIDEO}`))?.status()).toBe(404);
	expect((await page.request.get(`/mediathek/${VIDEO}/untertitel.vtt`)).status()).toBe(404);
});

test('Mediathek: Hub-Team pflegt Videos seines Hubs', async ({ page }) => {
	await anmelden(page, 'hanna');
	await page.goto('/hubs/chor');
	await expect(page.getByRole('link', { name: 'Video hochladen' })).toBeVisible();
	await page.goto(`/mediathek/${ENTWURF}/bearbeiten`);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Probe im Entwurf');
	await expect(page.getByRole('button', { name: 'Veröffentlichen' })).toBeDisabled();
	await keineA11yFehler(page);
	// Fremde Herkunft: kein Upload
	const r = await page.request.post('/mediathek/hochladen', {
		headers: { origin: 'https://example.com', 'content-type': 'application/json' },
		data: { unitId: '00000000-0000-4000-8000-0000000000b1', title: 'X', size: 10 }
	});
	expect(r.status()).toBe(403);
});

test('Mediathek: Weiter, wo du warst', async ({ page }) => {
	await anmelden(page, 'nils');
	const fremd = await page.request.post(`/mediathek/${VIDEO}/fortschritt`, {
		headers: { origin: 'https://example.com', 'content-type': 'application/json' },
		data: { s: 30 }
	});
	expect(fremd.status()).toBe(403);
	const r = await page.request.post(`/mediathek/${VIDEO}/fortschritt`, {
		headers: {
			origin: new URL(process.env.BASE_URL ?? 'http://localhost:3999').origin,
			'content-type': 'application/json'
		},
		data: { s: 70 }
	});
	expect(r.status()).toBe(204);
	await page.goto(`/mediathek/${VIDEO}`);
	await expect(page.getByText('Weiter bei 1:10')).toBeVisible();
	await page.goto('/mediathek');
	await expect(page.getByRole('heading', { name: 'Weiter ansehen' })).toBeVisible();
	await page.goto('/konto');
	await expect(
		page.getByRole('heading', { name: 'Fortschritt auf meinem Konto speichern' })
	).toBeVisible();
	await keineA11yFehler(page);
	await page.getByRole('button', { name: 'Meinen Fortschritt löschen' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click();
	await expect(page.getByText('Gelöscht.')).toBeVisible();
	await page.goto(`/mediathek/${VIDEO}`);
	await expect(page.getByText(/Weiter bei/)).toHaveCount(0);
});

test('Rückmeldungen bleiben sichtbar, auch auf langen Seiten', async ({ page }) => {
	await anmelden(page, 'hanna');
	await page.goto(`/mediathek/${ENTWURF}/bearbeiten`);
	await page.getByText('Eigene Untertitel-Datei hochladen').click();
	const datei = page.locator('input[name="datei"]');
	await datei.scrollIntoViewIfNeeded();
	await datei.setInputFiles({
		name: 'test.vtt',
		mimeType: 'text/vtt',
		buffer: Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.000\nHallo\n')
	});
	await page.getByRole('button', { name: 'Hochladen', exact: true }).click();
	// Die Meldung steht oben; unten erscheint sie zusätzlich, ganz im Fenster
	const leiste = page.locator('.meldungsleiste');
	await expect(leiste).toContainText('Untertitel gespeichert.');
	const box = await leiste.boundingBox();
	const fenster = page.viewportSize();
	expect(box && fenster && box.y + box.height <= fenster.height).toBeTruthy();
	const unten = page.locator('nav.unten');
	if (await unten.isVisible()) {
		const nav = await unten.boundingBox();
		expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
	}
	// Klick springt zur Meldung
	await leiste.getByRole('button', { name: /Untertitel gespeichert/ }).click();
	await expect(leiste).toHaveCount(0);
	await expect(
		page.getByRole('status').filter({ hasText: 'Untertitel gespeichert.' })
	).toBeInViewport();
	await page.getByRole('button', { name: 'Untertitel entfernen' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Entfernen' }).click();
});

test('Mediathek auf Handy und Tablet: Video bleibt oben, darunter Reiter', async ({ page }) => {
	await anmelden(page, 'nils');
	await page.goto(`/mediathek/${VIDEO}`);
	const reiter = page.getByRole('tablist', { name: 'Mehr zum Video' });
	if ((page.viewportSize()?.width ?? 1400) >= 1100) {
		// PC: alles nebeneinander, keine Reiter
		await expect(reiter).toBeHidden();
		return;
	}
	await expect(reiter.getByRole('tab', { name: 'Kapitel' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page.getByText('Kapitel 1/2')).toBeVisible();
	await reiter.getByRole('tab', { name: 'Info' }).click();
	await expect(page.getByText('So richtest du den Drucker ein.')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Kapitel', level: 2 })).toBeHidden();
	await keineA11yFehler(page);
	// Das Video bleibt beim Scrollen sichtbar
	await page.mouse.wheel(0, 800);
	await expect(page.locator('video')).toBeInViewport();
});
