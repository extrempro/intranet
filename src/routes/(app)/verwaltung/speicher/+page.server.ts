import { error, fail } from '@sveltejs/kit';
import { bestaetigungFehlt } from '#lib/server/auth/bestaetigung.ts';
import { isSystemAdmin } from '#lib/server/auth/access.ts';
import { requirePrincipal } from '#lib/server/auth/guard.ts';
import { audit } from '#lib/server/audit.ts';
import {
	eingabePruefen,
	gespeichertPruefen,
	s3EingabeLesen,
	s3Loeschen,
	s3Speichern,
	speicherUebersicht
} from '#lib/server/speicher-verwaltung.ts';
import { s3TestModus, SpeicherFehler, zuordnungSetzen } from '#lib/server/files/speicherorte.ts';
import { umzugAbbrechen, umzugStarten, UmzugFehler } from '#lib/server/files/umzug.ts';
import { db } from '#lib/server/db/index.ts';
import { storageTargets } from '#lib/server/db/schema.ts';
import { istKategorie } from '#lib/speicher.ts';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

/** Verwaltung → Speicher (Kap. 18): nur System-Admins. */
function requireSystemAdmin(locals: App.Locals) {
	const p = requirePrincipal(locals);
	if (!isSystemAdmin(p)) error(403, 'Das dürfen nur System-Admins.');
	return p;
}

const uuid = (v: FormDataEntryValue | null) => {
	const s = String(v ?? '');
	return /^[0-9a-f-]{36}$/i.test(s) ? s : null;
};

export const load: PageServerLoad = async ({ locals }) => {
	requireSystemAdmin(locals);
	return { ...(await speicherUebersicht()), testModus: s3TestModus() };
};

async function zielGibtEs(id: string) {
	const [t] = await db
		.select({ id: storageTargets.id })
		.from(storageTargets)
		.where(eq(storageTargets.id, id));
	return Boolean(t);
}

export const actions: Actions = {
	s3: async ({ request, locals, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		const b = bestaetigungFehlt(locals);
		if (b) return b;
		const fd = await request.formData();
		const id = uuid(fd.get('id'));
		if (id && !(await zielGibtEs(id))) error(404, 'Speicherort nicht gefunden');
		const { werte, felder } = s3EingabeLesen(fd);
		if (!id && !werte.secret) felder.secret = 'Gib den Secret Key ein.';
		const { secret: _ohne, ...anzeige } = werte;
		void _ohne;
		if (Object.keys(felder).length)
			return fail(400, {
				bereich: 's3',
				fehler: 'Bitte prüfe die markierten Felder.',
				felder,
				werte: anzeige,
				id
			});
		// Nur speichern, wenn die Verbindung klappt
		const pruefung = await eingabePruefen(werte, id);
		if (!pruefung.ok)
			return fail(400, { bereich: 's3', fehler: pruefung.meldung, pruefung, werte: anzeige, id });
		const neueId = await s3Speichern(werte, id, pruefung);
		await audit({
			category: 'admin',
			action: id ? 'storage.update' : 'storage.create',
			actorId: p.personId,
			entityType: 'storage_target',
			entityId: neueId,
			details: { name: werte.name, bucket: werte.bucket, secretGeaendert: Boolean(werte.secret) },
			ip: getClientAddress()
		});
		return { bereich: 's3', ergebnis: pruefung.meldung, pruefung };
	},

	pruefen: async ({ request, locals }) => {
		requireSystemAdmin(locals);
		const id = uuid((await request.formData()).get('id'));
		if (!id || !(await zielGibtEs(id))) error(404, 'Speicherort nicht gefunden');
		const pruefung = await gespeichertPruefen(id);
		return { bereich: `pruefen-${id}`, ergebnis: pruefung.meldung, pruefung };
	},

	loeschen: async ({ request, locals, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		const b = bestaetigungFehlt(locals);
		if (b) return b;
		const id = uuid((await request.formData()).get('id'));
		if (!id || !(await zielGibtEs(id))) error(404, 'Speicherort nicht gefunden');
		try {
			await s3Loeschen(id);
		} catch (err) {
			if (err instanceof SpeicherFehler)
				return fail(400, { bereich: `pruefen-${id}`, fehler: err.message });
			throw err;
		}
		await audit({
			category: 'admin',
			action: 'storage.delete',
			actorId: p.personId,
			entityType: 'storage_target',
			entityId: id,
			ip: getClientAddress()
		});
		return { bereich: 's3', ergebnis: 'Speicherort gelöscht.' };
	},

	zuordnen: async ({ request, locals, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		const b = bestaetigungFehlt(locals);
		if (b) return b;
		const fd = await request.formData();
		const k = String(fd.get('kategorie') ?? '');
		if (!istKategorie(k)) error(400, 'Unbekannte Inhaltsart');
		const rohZiel = String(fd.get('ziel') ?? 'lokal');
		const ziel = rohZiel === 'lokal' ? null : uuid(rohZiel);
		if (rohZiel !== 'lokal' && (!ziel || !(await zielGibtEs(ziel))))
			return fail(400, { bereich: `k-${k}`, fehler: 'Diesen Speicherort gibt es nicht.' });
		await zuordnungSetzen(k, ziel, p.personId);
		let umzug = false;
		if (fd.get('umziehen') === 'on') {
			try {
				await umzugStarten(k, ziel, p.personId);
				umzug = true;
			} catch (err) {
				if (err instanceof UmzugFehler)
					return fail(400, { bereich: `k-${k}`, fehler: err.message });
				throw err;
			}
		}
		await audit({
			category: 'admin',
			action: 'storage.assign',
			actorId: p.personId,
			entityType: 'storage_category',
			entityId: k,
			details: { ziel: ziel ?? 'lokal', umzug },
			ip: getClientAddress()
		});
		return {
			bereich: `k-${k}`,
			ergebnis: umzug
				? 'Gespeichert. Der Umzug läuft im Hintergrund.'
				: 'Gespeichert. Neue Dateien landen ab jetzt am gewählten Ort.'
		};
	},

	abbrechen: async ({ request, locals, getClientAddress }) => {
		const p = requireSystemAdmin(locals);
		const fd = await request.formData();
		const id = uuid(fd.get('id'));
		const k = String(fd.get('kategorie') ?? '');
		if (!id) error(400, 'Ungültiger Umzug');
		await umzugAbbrechen(id);
		await audit({
			category: 'admin',
			action: 'storage.move_cancel',
			actorId: p.personId,
			entityType: 'storage_move',
			entityId: id,
			ip: getClientAddress()
		});
		return {
			bereich: `k-${k}`,
			ergebnis:
				'Umzug abgebrochen. Bereits umgezogene Dateien bleiben am neuen Ort, die übrigen am alten.'
		};
	}
};
