import { fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	ContactValidationError,
	ProfileError,
	removePhoto,
	setPhoto,
	updateContact
} from '#lib/server/people.ts';
import { uploadLimit } from '#lib/server/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

/** Profil steht auf der Konto-Seite; hier nur noch die Aktionen (Foto, Kontaktdaten). */
export const load: PageServerLoad = ({ locals }) => {
	requirePrincipal(locals);
	redirect(303, '/konto');
};

const str = (f: FormData, k: string) => String(f.get(k) ?? '').slice(0, 200);

export const actions: Actions = {
	kontakt: async ({ request, locals }) => {
		const f = await request.formData();
		try {
			await updateContact(requirePrincipal(locals), {
				position: str(f, 'position'),
				phone: str(f, 'telefon'),
				mobile: str(f, 'mobil'),
				mobileVisibility: str(f, 'sichtbarkeit'),
				room: str(f, 'raum')
			});
		} catch (err) {
			if (err instanceof ContactValidationError)
				return fail(400, { bereich: 'profil', fehler: err.message, felder: err.errors });
			throw err;
		}
		return { bereich: 'profil', ok: 'Kontaktdaten gespeichert.' };
	},
	foto: async ({ request, locals }) => {
		if (!uploadLimit.hit(requirePrincipal(locals).personId))
			return fail(429, {
				bereich: 'profil',
				fehler: 'Zu viele Uploads in der letzten Stunde. Versuch es bitte später noch einmal.'
			});
		const datei = (await request.formData()).get('foto');
		try {
			await setPhoto(requirePrincipal(locals), datei as File);
		} catch (err) {
			if (err instanceof ProfileError) return fail(400, { bereich: 'profil', fehler: err.message });
			throw err;
		}
		return { bereich: 'profil', ok: 'Foto gespeichert.' };
	},
	fotoLoeschen: async ({ locals }) => {
		await removePhoto(requirePrincipal(locals).personId);
		return { bereich: 'profil', ok: 'Foto gelöscht.' };
	}
};
