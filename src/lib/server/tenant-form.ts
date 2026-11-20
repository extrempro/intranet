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
		bgDark: s('hintergrund_dunkel', 7)
	};
}
