import { error, fail, redirect } from '@sveltejs/kit';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/audit.ts';
import {
	anhaengeVon,
	bearbeitenDaten,
	cuesAus,
	ersatzVon,
	kapitelSetzen,
	MediathekFehler,
	metaSpeichern,
	ohneUntertitel,
	textSpeichern,
	untertitelBereit,
	untertitelKorrigieren,
	untertitelPruefen,
	untertitelSetzen,
	veroeffentlichen,
	videoLoeschen
} from '#lib/server/mediathek.ts';
import { alleThemen, ThemaFehler } from '#lib/server/themen.ts';
import type { Actions, PageServerLoad } from './$types';

/** Video bearbeiten (Kap. 8.15): nur mit dem Recht „Mediathek“ der Einheit. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	try {
		const v = await bearbeitenDaten(p, params.id);
		// Neue Fassung in Arbeit: zum Video selbst
		if (v.replacesId) redirect(303, `/mediathek/${v.replacesId}/bearbeiten`);
		const { captionsVtt, captionsText: _t, uploadHead: _h, ...rest } = v;
		void _t;
		void _h;
		const ersatz = await ersatzVon(v.id);
		return {
			v: {
				...rest,
				hatUntertitel: Boolean(captionsVtt),
				bereit: untertitelBereit(v),
				/** Abgebrochenes Hochladen nur von der Person fortsetzbar, die es begonnen hat */
				eigenerUpload: v.createdBy === p.personId
			},
			cues: cuesAus(captionsVtt),
			anhaenge: await anhaengeVon(v.id),
			ersatz: ersatz && {
				...ersatz,
				eigener: ersatz.createdBy === p.personId
			},
			themen: await alleThemen()
		};
	} catch (err) {
		if (err instanceof MediathekFehler) error(err.status === 400 ? 404 : err.status, err.message);
		throw err;
	}
};

async function mit(
	locals: App.Locals,
	fn: (p: ReturnType<typeof requirePrincipal>) => Promise<string | void>
) {
	const p = requirePrincipal(locals);
	try {
		const ergebnis = await fn(p);
		return { ergebnis: ergebnis ?? 'Gespeichert.' };
	} catch (err) {
		if (err instanceof MediathekFehler) return fail(err.status, { fehler: err.message });
		if (err instanceof ThemaFehler) return fail(400, { fehler: err.message });
		throw err;
	}
}

export const actions: Actions = {
	meta: async ({ request, locals, params }) => {
		const fd = await request.formData();
		return mit(locals, async (p) => {
			const tenantIds = fd.getAll('mandant').map(String);
			await metaSpeichern(p, params.id, {
				title: String(fd.get('title') ?? ''),
				description: String(fd.get('description') ?? ''),
				themen: fd.getAll('thema').map(String),
				tenantIds: tenantIds.length ? tenantIds : null
			});
		});
	},
	untertitel: async ({ request, locals, params }) => {
		const fd = await request.formData();
		const datei = fd.get('datei');
		if (!(datei instanceof File) || datei.size === 0)
			return fail(400, { fehler: 'Wähle eine WebVTT-Datei aus.' });
		if (datei.size > 2_000_000)
			return fail(400, { fehler: 'Die Untertiteldatei ist zu groß (höchstens 2 MB).' });
		const text = await datei.text();
		return mit(locals, async (p) => {
			await untertitelSetzen(p, params.id, text);
			return 'Untertitel gespeichert.';
		});
	},
	untertitelWeg: async ({ locals, params }) =>
		mit(locals, async (p) => {
			await untertitelSetzen(p, params.id, null);
			return 'Untertitel entfernt. Ohne Untertitel ist das Video nicht veröffentlicht.';
		}),
	kapitel: async ({ request, locals, params }) => {
		const fd = await request.formData();
		let liste: unknown;
		try {
			liste = JSON.parse(String(fd.get('kapitel') ?? '[]'));
		} catch {
			return fail(400, { fehler: 'Die Kapitel konnten nicht gelesen werden.' });
		}
		return mit(locals, async (p) => {
			await kapitelSetzen(p, params.id, liste as { s: number; t: string }[]);
			return 'Kapitel gespeichert.';
		});
	},
	veroeffentlichen: async ({ locals, params }) =>
		mit(locals, async (p) => {
			await veroeffentlichen(p, params.id, true);
			return 'Veröffentlicht. Alle mit Zugriff auf die Einheit sehen das Video jetzt.';
		}),
	zurueckziehen: async ({ locals, params }) =>
		mit(locals, async (p) => {
			await veroeffentlichen(p, params.id, false);
			return 'Zurückgezogen. Das Video ist wieder ein Entwurf.';
		}),
	untertitelText: async ({ request, locals, params }) => {
		const fd = await request.formData();
		let texte: unknown;
		try {
			texte = JSON.parse(String(fd.get('texte') ?? '[]'));
		} catch {
			return fail(400, { fehler: 'Die Untertitel konnten nicht gelesen werden.' });
		}
		return mit(locals, async (p) => {
			await untertitelKorrigieren(p, params.id, texte);
			return 'Untertitel gespeichert.';
		});
	},
	ohneUntertitel: async ({ request, locals, params }) => {
		const fd = await request.formData();
		const grund = fd.get('aus') === '1' ? null : String(fd.get('grund') ?? '');
		return mit(locals, async (p) => {
			await ohneUntertitel(p, params.id, grund);
			return grund
				? 'Gespeichert: Dieses Video braucht keine Untertitel.'
				: 'Gespeichert: Das Video braucht wieder Untertitel.';
		});
	},
	geprueft: async ({ request, locals, params }) => {
		const an = (await request.formData()).get('wert') === 'an';
		return mit(locals, async (p) => {
			await untertitelPruefen(p, params.id, an);
			return an
				? 'Untertitel als geprüft markiert. Du kannst das Video jetzt veröffentlichen.'
				: 'Markierung „geprüft“ zurückgenommen.';
		});
	},
	textfassung: async ({ request, locals, params }) => {
		const fd = await request.formData();
		return mit(locals, async (p) => {
			await textSpeichern(p, params.id, {
				html: String(fd.get('text') ?? ''),
				anhaenge: fd.getAll('anhaenge').map(String).slice(0, 50)
			});
			return 'Textfassung und Anhänge gespeichert.';
		});
	},
	ersatzAbbrechen: async ({ locals, params }) =>
		mit(locals, async (p) => {
			const e = await ersatzVon(params.id);
			if (e) await videoLoeschen(p, e.id);
			return 'Die neue Fassung wurde verworfen. Das bisherige Video bleibt.';
		}),
	loeschen: async ({ locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		let titel: string;
		let ziel: string;
		try {
			const v = await bearbeitenDaten(p, params.id);
			ziel = v.unit.type === 'hub' ? `/hubs/${v.unit.slug}` : `/abteilungen/${v.unit.slug}`;
			titel = await videoLoeschen(p, params.id);
		} catch (err) {
			if (err instanceof MediathekFehler) return fail(err.status, { fehler: err.message });
			throw err;
		}
		await audit({
			category: 'admin',
			action: 'video.delete',
			actorId: p.personId,
			entityType: 'video',
			entityId: params.id,
			details: { title: titel },
			ip: getClientAddress()
		});
		redirect(303, ziel);
	}
};
