/** Formular-Aktion für den Umschalter „Ansicht“ langer Listen (Kap. 6.7). */
import { fail, type Action } from '@sveltejs/kit';
import { requirePrincipal } from './auth/guard.ts';
import { setListView, type ListView } from './preferences.ts';

const ANSICHTEN: ListView[] = ['ausfuehrlich', 'kompakt'];

export const ansichtAction: Action = async ({ request, locals }) => {
	const p = requirePrincipal(locals);
	const wert = String((await request.formData()).get('ansicht') ?? '') as ListView;
	if (!ANSICHTEN.includes(wert)) return fail(400, { fehler: 'Unbekannte Ansicht.' });
	await setListView(p.personId, wert);
	return { ansicht: wert };
};
