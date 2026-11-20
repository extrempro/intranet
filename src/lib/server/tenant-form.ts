import { FARB_FELDER, type UiFarben } from '../color.ts';
import type { TenantInput } from './tenants.ts';

export function readTenantForm(form: FormData): TenantInput {
	const s = (k: string, max: number) =>
		String(form.get(k) ?? '')
			.trim()
			.slice(0, max);
	return {
		name: s('name', 200),
		shortName: s('kuerzel', 20),
		accent: s('akzent', 7),
		accentDark: s('akzent_dunkel', 7),
		bg: s('hintergrund', 7),
		bgDark: s('hintergrund_dunkel', 7),
		ui: uiFarben(form)
	};
}

/** Felder „farbe_<modus>_<feld>“ (leer = Standard). */
function uiFarben(form: FormData): UiFarben {
	const out: UiFarben = {};
	for (const m of ['hell', 'dunkel'] as const) {
		for (const f of FARB_FELDER) {
			if (f === 'hintergrund') continue;
			const v = String(form.get(`farbe_${m}_${f}`) ?? '')
				.trim()
				.slice(0, 7);
			if (v) out[m] = { ...out[m], [f]: v };
		}
	}
	return out;
}
