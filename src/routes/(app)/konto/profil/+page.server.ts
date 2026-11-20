import { fail } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	ContactValidationError,
	getOwnProfile,
	ProfileError,
	removePhoto,
	setPhoto,
	updateContact
} from '#lib/server/people.ts';
import { uploadLimit } from '#lib/server/rate-limit.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({
	profil: await getOwnProfile(requirePrincipal(locals))
});

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
				return fail(400, { fehler: err.message, felder: err.errors });
			throw err;
		}
		return { ok: 'Kontaktdaten gespeichert.' };
	},
	foto: async ({ request, locals }) => {
		if (!uploadLimit.hit(requirePrincipal(locals).personId))
			return fail(429, {
				fehler: 'Zu viele Uploads in der letzten Stunde. Versuch es bitte später noch einmal.'
			});
		const datei = (await request.formData()).get('foto');
		try {
			await setPhoto(requirePrincipal(locals), datei as File);
		} catch (err) {
			if (err instanceof ProfileError) return fail(400, { fehler: err.message });
			throw err;
		}
		return { ok: 'Foto gespeichert.' };
	},
	fotoLoeschen: async ({ locals }) => {
		await removePhoto(requirePrincipal(locals).personId);
		return { ok: 'Foto gelöscht.' };
	}
};
