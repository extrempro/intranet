import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	CanteenError,
	deleteClosure,
	deleteMenu,
	operatorOverview,
	replaceMenu,
	saveClosure,
	saveInfo,
	setClosedToday,
	uploadMenu
} from '#lib/server/canteen.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) =>
	operatorOverview(requirePrincipal(locals));

function guard<T>(fn: () => Promise<T>) {
	return fn().catch((err) => {
		if (err instanceof CanteenError) return fail(400, { fehler: err.message });
		throw err;
	});
}

const file = (v: FormDataEntryValue | null) => (v instanceof File ? v : null);

export const actions: Actions = {
	hochladen: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const dates = { validFrom: String(f.get('von') ?? ''), validUntil: String(f.get('bis') ?? '') };
		try {
			const titel = await uploadMenu(p, dates, file(f.get('datei')), getClientAddress());
			return { toast: `${titel} hochgeladen.` };
		} catch (err) {
			if (err instanceof CanteenError) return fail(400, { fehler: err.message, upload: dates });
			throw err;
		}
	},
	ersetzen: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		return guard(async () => {
			const titel = await replaceMenu(
				p,
				String(f.get('id') ?? ''),
				file(f.get('datei')),
				getClientAddress()
			);
			return { toast: `Neue Datei für ${titel} gespeichert.` };
		});
	},
	loeschen: async ({ request, locals, getClientAddress }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		return guard(async () => {
			const titel = await deleteMenu(p, String(f.get('id') ?? ''), getClientAddress());
			return { toast: `${titel} gelöscht.` };
		});
	},
	infos: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const hours = Array.from({ length: 7 }, (_, i) => ({
			open: f.get(`offen_${i}`) === 'on',
			from: String(f.get(`von_${i}`) ?? ''),
			to: String(f.get(`bis_${i}`) ?? '')
		}));
		return guard(async () => {
			await saveInfo(p, {
				hours,
				place: String(f.get('lage') ?? ''),
				note: String(f.get('hinweis') ?? ''),
				contact: String(f.get('kontakt') ?? '')
			});
			return { toast: 'Kantinen-Infos gespeichert.' };
		});
	},
	heute: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const zu = (await request.formData()).get('zu') === 'ja';
		return guard(async () => {
			await setClosedToday(p, zu);
			return {
				toast: zu
					? 'Hinweis „Heute geschlossen“ ist jetzt sichtbar.'
					: 'Hinweis „Heute geschlossen“ entfernt.'
			};
		});
	},
	schliessung: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '') || null;
		const input = {
			fromDate: String(f.get('von') ?? ''),
			untilDate: String(f.get('bis') ?? ''),
			reason: String(f.get('grund') ?? ''),
			announceDays: Number(f.get('ankuendigen') ?? 0)
		};
		return guard(async () => {
			const r = await saveClosure(p, id, input);
			if (!r.ok) return fail(400, { schliessung: { id, ...input }, schliessFehler: r.errors });
			return { toast: 'Schließzeit gespeichert.' };
		});
	},
	schliessungLoeschen: async ({ request, locals }) => {
		const p = requirePrincipal(locals);
		const f = await request.formData();
		return guard(async () => {
			await deleteClosure(p, String(f.get('id') ?? ''));
			return { toast: 'Schließzeit gelöscht.' };
		});
	}
};
