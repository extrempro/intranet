import { error, fail, redirect } from '@sveltejs/kit';
import { cleanLayout } from '#lib/hubs.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import {
	dokumentAendern,
	dokumenteHinzufuegen,
	dokumentLoeschen,
	dokumentVerschieben,
	hubBildEntfernen,
	hubBildSetzen,
	kontaktAendern,
	kontaktEntfernen,
	kontaktHinzufuegen,
	kontaktVerschieben,
	linkAendern,
	linkEntfernen,
	linkHinzufuegen,
	linkVerschieben,
	ordnerAnlegen,
	ordnerLoeschen,
	ordnerUmbenennen,
	ordnerVerschieben,
	teamAufgabe,
	type HubBild
} from '#lib/server/hub-inhalte.ts';
import { archiveHub, getHub, HubError, setResting, updateHubPage } from '#lib/server/hubs.ts';
import { uploadLimit } from '#lib/server/rate-limit.ts';
import {
	addMember,
	removeMember,
	setMemberRights,
	teamFuerPflege,
	UnitError
} from '#lib/server/units.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const p = requirePrincipal(locals);
	const hub = await getHub(p, params.slug);
	if (!hub || !(hub.canManage || hub.canDocs))
		error(404, 'Diesen Hub gibt es nicht oder du darfst ihn nicht bearbeiten.');
	return { hub, pflege: hub.canManage ? await teamFuerPflege(p, hub.id) : null };
};

async function hubId(locals: App.Locals, slug: string) {
	const hub = await getHub(requirePrincipal(locals), slug);
	if (!hub) error(404, 'Diesen Hub gibt es nicht.');
	return hub.id;
}

/** Aktion ausführen; `bereich` sagt der Seite, wo die Meldung erscheint */
async function guard(bereich: string, fn: () => Promise<unknown>, ok: string) {
	try {
		const r = await fn();
		if (r && typeof r === 'object' && 'fehler' in r && r.fehler)
			return fail(400, { bereich, fehler: String(r.fehler) });
		return { bereich, ok };
	} catch (err) {
		if (err instanceof HubError || err instanceof UnitError)
			return fail(400, { bereich, fehler: err.message });
		throw err;
	}
}

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').slice(0, max);
const richtung = (f: FormData) => (f.get('richtung') === 'hoch' ? -1 : 1) as -1 | 1;

export const actions: Actions = {
	speichern: async ({ request, locals, params }) => {
		const f = await request.formData();
		let layout;
		try {
			layout = cleanLayout(JSON.parse(String(f.get('aufbau') ?? '{}')));
		} catch {
			return fail(400, { bereich: 'seite', fehler: 'Ungültiger Seitenaufbau.' });
		}
		const id = await hubId(locals, params.slug);
		return guard(
			'seite',
			() =>
				updateHubPage(requirePrincipal(locals), id, {
					notice: f.get('hinweis_an') === 'on' ? str(f, 'hinweis', 1000) : '',
					noticeUntil: str(f, 'hinweis_bis', 20),
					coordinator: str(f, 'koordination', 40),
					about: str(f, 'kurz', 1000),
					aboutHtml: str(f, 'ueber', 200_000),
					layout
				}),
			'Seite gespeichert.'
		);
	},
	bild: async ({ request, locals, params, getClientAddress }) => {
		const p = requirePrincipal(locals);
		if (!uploadLimit.hit(p.personId))
			return fail(429, { bereich: 'bilder', fehler: 'Zu viele Uploads. Versuch es später.' });
		const f = await request.formData();
		const art: HubBild = f.get('art') === 'symbol' ? 'symbol' : 'titelbild';
		const id = await hubId(locals, params.slug);
		return guard(
			'bilder',
			() => hubBildSetzen(p, id, art, f.get('foto'), getClientAddress()),
			art === 'symbol' ? 'Symbol gespeichert.' : 'Titelbild gespeichert.'
		);
	},
	bildLoeschen: async ({ request, locals, params, getClientAddress }) => {
		const art: HubBild =
			(await request.formData()).get('art') === 'symbol' ? 'symbol' : 'titelbild';
		const id = await hubId(locals, params.slug);
		return guard(
			'bilder',
			() => hubBildEntfernen(requirePrincipal(locals), id, art, getClientAddress()),
			art === 'symbol' ? 'Symbol entfernt.' : 'Titelbild entfernt.'
		);
	},

	// --- Team und Schreibrechte ---
	hinzufuegen: async ({ request, locals, params, getClientAddress }) => {
		const email = str(await request.formData(), 'email', 320);
		const id = await hubId(locals, params.slug);
		return guard(
			'team',
			() => addMember(requirePrincipal(locals), id, email, getClientAddress()),
			'Zum Team hinzugefügt.'
		);
	},
	rechte: async ({ request, locals, params, getClientAddress }) => {
		const f = await request.formData();
		const on = (k: string) => f.get(k) === 'on';
		const id = await hubId(locals, params.slug);
		return guard(
			'team',
			() =>
				setMemberRights(
					requirePrincipal(locals),
					id,
					str(f, 'person', 40),
					{
						isPrimary: false,
						mayWriteNews: on('neuigkeiten'),
						mayWriteFaqs: on('faqs'),
						mayWriteEvents: on('termine'),
						mayWriteBehindScenes: false,
						mayWriteDocuments: on('dokumente'),
						verwaltet: on('hubteam')
					},
					getClientAddress()
				),
			'Rechte gespeichert.'
		);
	},
	aufgabe: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'team',
			() => teamAufgabe(requirePrincipal(locals), id, str(f, 'person', 40), str(f, 'aufgabe')),
			'Aufgabe gespeichert.'
		);
	},
	entfernen: async ({ request, locals, params, getClientAddress }) => {
		const person = str(await request.formData(), 'person', 40);
		const id = await hubId(locals, params.slug);
		return guard(
			'team',
			() => removeMember(requirePrincipal(locals), id, person, getClientAddress()),
			'Aus dem Team entfernt.'
		);
	},

	// --- Ansprechpersonen ---
	kontaktNeu: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'kontakte',
			() =>
				kontaktHinzufuegen(requirePrincipal(locals), id, str(f, 'email', 320), str(f, 'aufgabe')),
			'Ansprechperson hinzugefügt.'
		);
	},
	kontaktAendern: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'kontakte',
			() => kontaktAendern(requirePrincipal(locals), id, str(f, 'id', 40), str(f, 'aufgabe')),
			'Gespeichert.'
		);
	},
	kontaktEntfernen: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'kontakte',
			() => kontaktEntfernen(requirePrincipal(locals), id, str(f, 'id', 40)),
			'Ansprechperson entfernt.'
		);
	},
	kontaktVerschieben: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'kontakte',
			() => kontaktVerschieben(requirePrincipal(locals), id, str(f, 'id', 40), richtung(f)),
			'Reihenfolge gespeichert.'
		);
	},

	// --- Schnellzugriff ---
	linkNeu: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'links',
			() =>
				linkHinzufuegen(requirePrincipal(locals), id, {
					label: str(f, 'titel'),
					description: str(f, 'beschreibung'),
					url: str(f, 'adresse', 2000),
					icon: str(f, 'symbol', 40)
				}),
			'Link hinzugefügt.'
		);
	},
	linkAendern: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'links',
			() =>
				linkAendern(requirePrincipal(locals), id, str(f, 'id', 40), {
					label: str(f, 'titel'),
					description: str(f, 'beschreibung'),
					url: str(f, 'adresse', 2000),
					icon: str(f, 'symbol', 40)
				}),
			'Link gespeichert.'
		);
	},
	linkEntfernen: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'links',
			() => linkEntfernen(requirePrincipal(locals), id, str(f, 'id', 40)),
			'Link entfernt.'
		);
	},
	linkVerschieben: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'links',
			() => linkVerschieben(requirePrincipal(locals), id, str(f, 'id', 40), richtung(f)),
			'Reihenfolge gespeichert.'
		);
	},

	// --- Dokumente ---
	ordnerNeu: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() => ordnerAnlegen(requirePrincipal(locals), id, str(f, 'name')),
			'Ordner angelegt.'
		);
	},
	ordnerAendern: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() => ordnerUmbenennen(requirePrincipal(locals), id, str(f, 'id', 40), str(f, 'name')),
			'Ordner umbenannt.'
		);
	},
	ordnerLoeschen: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() => ordnerLoeschen(requirePrincipal(locals), id, str(f, 'id', 40)),
			'Ordner gelöscht. Die Dokumente darin stehen jetzt ohne Ordner.'
		);
	},
	ordnerVerschieben: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() => ordnerVerschieben(requirePrincipal(locals), id, str(f, 'id', 40), richtung(f)),
			'Reihenfolge gespeichert.'
		);
	},
	dokumenteNeu: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() =>
				dokumenteHinzufuegen(
					requirePrincipal(locals),
					id,
					f.getAll('anhaenge').map(String),
					str(f, 'ordner', 40) || null
				),
			'Dokumente hinzugefügt.'
		);
	},
	dokumentAendern: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() =>
				dokumentAendern(requirePrincipal(locals), id, str(f, 'id', 40), {
					title: str(f, 'titel'),
					description: str(f, 'beschreibung', 1000),
					ordner: str(f, 'ordner', 40) || null
				}),
			'Dokument gespeichert.'
		);
	},
	dokumentLoeschen: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() => dokumentLoeschen(requirePrincipal(locals), id, str(f, 'id', 40)),
			'Dokument gelöscht.'
		);
	},
	dokumentVerschieben: async ({ request, locals, params }) => {
		const f = await request.formData();
		const id = await hubId(locals, params.slug);
		return guard(
			'dokumente',
			() => dokumentVerschieben(requirePrincipal(locals), id, str(f, 'id', 40), richtung(f)),
			'Reihenfolge gespeichert.'
		);
	},

	// --- Ruhen und Archivieren ---
	ruhen: async ({ request, locals, params, getClientAddress }) => {
		const an = (await request.formData()).get('ruhen') === 'ja';
		const id = await hubId(locals, params.slug);
		return guard(
			'ruhen',
			() => setResting(requirePrincipal(locals), id, an, getClientAddress()),
			an ? 'Der Hub ruht jetzt.' : 'Der Hub ist wieder aktiv.'
		);
	},
	archivieren: async ({ locals, params, getClientAddress }) => {
		const id = await hubId(locals, params.slug);
		const r = await guard(
			'archiv',
			() => archiveHub(requirePrincipal(locals), id, getClientAddress()),
			''
		);
		if ('status' in r) return r;
		redirect(303, '/hubs');
	}
};
