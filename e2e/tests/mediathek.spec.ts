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
