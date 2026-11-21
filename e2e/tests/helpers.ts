import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Personen aus seed.sql; das Cookie enthält das Token „e2e-<Name>“. */
export type Person = 'ada' | 'nils' | 'hanna' | 'bea';

export async function anmelden(page: Page, wer: Person) {
	const url = new URL(process.env.BASE_URL ?? 'http://localhost:3999');
	await page.context().addCookies([
		{
			name: '__Host-intranet-sitzung',
			value: `e2e-${wer}`,
			domain: url.hostname,
			path: '/',
			secure: true,
			httpOnly: true,
			sameSite: 'Lax'
		}
	]);
}

/** Keine Verstöße gegen WCAG 2.2 A/AA, die axe-core erkennt. */
export async function keineA11yFehler(page: Page) {
	const ergebnis = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	const kurz = ergebnis.violations.map(
		(v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
	);
	expect(kurz, 'Barrierefreiheit').toEqual([]);
}

/** Die Seite ist nicht breiter als der Bildschirm (nichts läuft aus der Maske). */
export async function nichtZuBreit(page: Page) {
	const [breite, sicht] = await page.evaluate(() => [
		document.documentElement.scrollWidth,
		window.innerWidth
	]);
	expect(breite, 'Seitenbreite').toBeLessThanOrEqual(sicht);
}
