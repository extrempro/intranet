<script lang="ts">
	/**
	 * Abteilung bearbeiten: Aufbau der Seite (Reiter, Blöcke im Überblick),
	 * Schnellzugriff und Dokumente wie bei Hubs. Alles bleibt im Browser, bis
	 * „Speichern“ es in einem Schritt übernimmt.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { untrack } from 'svelte';
	import Anhaenge from '../Anhaenge.svelte';
	import Icon from '../Icon.svelte';
	import Info from '../Info.svelte';
	import ZielWaehlen, { type Ziel } from '../ZielWaehlen.svelte';
	import {
		ABTEILUNG_BLOECKE,
		HUB_GRENZEN,
		HUB_REITER,
		LINK_SYMBOLE,
		type HubLayout
	} from '#lib/hubs.ts';
	import { navAreas } from '#lib/nav.ts';

	interface Einheit {
		id: string;
		layout: HubLayout;
		links: { label: string; description: string | null; url: string; icon: string }[];
		ordner: { id: string; name: string }[];
		dokumente: {
			id: string;
			fileId: string;
			folderId: string | null;
			title: string;
			name: string;
		}[];
	}

	let { einheit, meldung }: { einheit: Einheit; meldung: { fehler?: string; ok?: string } | null } =
		$props();

	const e = untrack(() => einheit);

	// --- Aufbau: Reihenfolge der Reiter, Blöcke im Überblick an oder aus ---
	type Bereich = 'reiter' | 'block';
	interface Zeile {
		key: string;
		bereich: Bereich;
		an: boolean;
	}
	let aufbau = $state<Zeile[]>([
		...e.layout.reiter.map((key) => ({ key, bereich: 'reiter' as const, an: true })),
		...e.layout.ueberblick.map((key) => ({ key, bereich: 'block' as const, an: true })),
		...ABTEILUNG_BLOECKE.filter((b) => !e.layout.ueberblick.includes(b.key)).map((b) => ({
			key: b.key,
			bereich: 'block' as const,
			an: false
		}))
	]);
	const LABEL: Record<Bereich, Record<string, string>> = {
		reiter: Object.fromEntries(HUB_REITER.map((r) => [r.key, r.label])),
		block: Object.fromEntries(ABTEILUNG_BLOECKE.map((b) => [b.key, b.label]))
	};
	function schieben(z: Zeile, d: -1 | 1) {
		const gleich = aufbau.filter((x) => x.bereich === z.bereich);
		const nachbar = gleich[gleich.indexOf(z) + d];
		if (!nachbar) return;
		const a = aufbau.indexOf(z);
		const b = aufbau.indexOf(nachbar);
		[aufbau[a], aufbau[b]] = [aufbau[b], aufbau[a]];
	}

	// --- Schnellzugriff ---
	let links = $state(
		e.links.map((l) => ({
			label: l.label,
			description: l.description ?? '',
			url: l.url,
			icon: l.icon
		}))
	);
	const ziele: Ziel[] = $derived([
		...navAreas().flatMap((a) =>
			a.pages.map((pg) => ({ gruppe: `Im Intranet: ${a.label}`, label: pg.label, url: pg.href }))
		),
		{ gruppe: 'Diese Abteilung', label: 'Häufige Fragen', url: `/faqs?einheit=${e.id}` },
		{ gruppe: 'Diese Abteilung', label: 'Termin anlegen', url: `/kalender/neu?absender=${e.id}` },
		...e.dokumente.map((d) => ({
			gruppe: 'Dokumente dieser Abteilung',
			label: d.title,
			url: `/dateien/${d.fileId}`
		}))
	]);
	let zielFenster: ReturnType<typeof ZielWaehlen> | undefined = $state();
	let zielFuer = $state(-1);
	function zielWaehlen(i: number) {
		zielFuer = i;
		void zielFenster?.oeffnen({ url: links[i].url, icon: links[i].icon });
	}
	const zielText = (url: string) =>
		ziele.find((z) => z.url === url)?.label ?? url.replace(/^https?:\/\//, '');

	// --- Dokumente ---
	let dokumente = $state(
		e.dokumente.map((d) => ({
			id: d.id,
			title: d.title,
			name: d.name,
			ordner: e.ordner.find((o) => o.id === d.folderId)?.name ?? ''
		}))
	);
	const ordnerNamen = $derived(
		[...new Set(dokumente.map((d) => d.ordner.trim()).filter(Boolean))].sort()
	);

	const daten = $derived(
		JSON.stringify({
			aufbau: {
				reiter: aufbau.filter((z) => z.bereich === 'reiter').map((z) => z.key),
				ueberblick: aufbau.filter((z) => z.bereich === 'block' && z.an).map((z) => z.key)
			},
			links,
			dokumente: dokumente.map((d) => ({ id: d.id, title: d.title, ordner: d.ordner }))
		})
	);

	let schluessel = $state(0);
	const absenden: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') schluessel++;
		};
</script>

<form method="POST" action="?/gestaltung" class="stapel" use:enhance={absenden}>
	<input type="hidden" name="daten" value={daten} />
	{#if meldung?.fehler}<p class="meldung fehler" role="alert">{meldung.fehler}</p>{/if}
	{#if meldung?.ok}<p class="meldung" role="status">{meldung.ok}</p>{/if}

	<section class="stapel eng" aria-labelledby="ag-l">
		<h3 id="ag-l" class="mit-info">
			Aufbau der Seite<Info
				thema="Aufbau der Seite"
				text="Die Abteilungsseite hat Reiter: den Überblick und Unterseiten wie Termine oder Dokumente. Leg fest, in welcher Reihenfolge die Reiter stehen und welche Blöcke der Überblick zeigt. Leere Reiter und Blöcke sehen Leser nicht, Ausgeblendetes behält seine Inhalte."
			/>
		</h3>
		<div class="bereiche">
			{#each [['reiter', 'Reihenfolge der Reiter'], ['block', 'Blöcke im Überblick']] as const as [bereich, titel] (bereich)}
				{@const liste = aufbau.filter((z) => z.bereich === bereich)}
				<div role="list" aria-label={titel}>
					<span class="bereichstitel">{titel}</span>
					{#if bereich === 'reiter'}
						<div class="aufbauzeile fest" role="listitem">
							<span>Überblick (immer vorne)</span>
						</div>
					{/if}
					{#each liste as z, i (z.key)}
						{@const name = LABEL[bereich][z.key]}
						<div class="aufbauzeile" role="listitem">
							<span id="ag-{bereich}-{z.key}" class:aus={!z.an}>{name}</span>
							<button
								type="button"
								class="knopf zweit mini"
								disabled={i === 0}
								aria-label="{name} nach oben"
								onclick={() => schieben(z, -1)}
							>
								↑
							</button>
							<button
								type="button"
								class="knopf zweit mini"
								disabled={i === liste.length - 1}
								aria-label="{name} nach unten"
								onclick={() => schieben(z, 1)}
							>
								↓
							</button>
							{#if bereich === 'block'}
								<input
									type="checkbox"
									class="schalter"
									role="switch"
									aria-labelledby="ag-{bereich}-{z.key}"
									bind:checked={z.an}
								/>
							{/if}
						</div>
					{/each}
					{#if bereich === 'block'}
						<p class="hinweis aufbauhinweis">
							Daneben stehen immer die Ansprechpersonen (Leitung und Stellvertretung) und die
							Videos.
						</p>
					{/if}
				</div>
			{/each}
		</div>
	</section>

	<section class="stapel eng" aria-labelledby="ag-q">
		<div class="kopf">
			<h3 id="ag-q">Schnellzugriff</h3>
			<button
				type="button"
				class="knopf zweit klein"
				disabled={links.length >= HUB_GRENZEN.links}
				onclick={() => {
					links.push({ label: '', description: '', url: '', icon: 'link' });
					zielWaehlen(links.length - 1);
				}}
			>
				Schnellzugriff hinzufügen
			</button>
		</div>
		<p class="hinweis unter">
			Kacheln mit Links, z. B. zu Formularen oder zum Ticket-System. Höchstens {HUB_GRENZEN.links}.
		</p>
		<ul class="zeilen">
			{#each links as l, i (i)}
				<li>
					<span class="symbol" aria-hidden="true">
						<Icon
							d={(LINK_SYMBOLE as Record<string, { d: string }>)[l.icon]?.d ?? LINK_SYMBOLE.link.d}
							size={20}
						/>
					</span>
					<input
						aria-label="Bezeichnung"
						placeholder="Bezeichnung"
						maxlength={HUB_GRENZEN.linkTitel}
						bind:value={l.label}
					/>
					<input
						aria-label="Kurzbeschreibung"
						placeholder="Kurzbeschreibung"
						maxlength={HUB_GRENZEN.linkBeschreibung}
						bind:value={l.description}
					/>
					<button
						type="button"
						class="knopf zweit klein ziel"
						title={l.url || 'Noch kein Ziel'}
						onclick={() => zielWaehlen(i)}
					>
						{l.url ? zielText(l.url) : 'Ziel wählen'}<span class="sr-only">, ändern</span>
					</button>
					<span class="knoepfe">
						<button
							type="button"
							class="knopf zweit mini"
							disabled={i === 0}
							aria-label="{l.label || 'Link'} nach oben"
							onclick={() => ([links[i - 1], links[i]] = [links[i], links[i - 1]])}
						>
							↑
						</button>
						<button
							type="button"
							class="knopf zweit klein"
							onclick={() => links.splice(i, 1)}
							aria-label="{l.label || 'Link'} entfernen"
						>
							Entfernen
						</button>
					</span>
				</li>
			{:else}
				<li class="leer">Noch kein Schnellzugriff.</li>
			{/each}
		</ul>
		<ZielWaehlen
			bind:this={zielFenster}
			{ziele}
			onwahl={(w) => {
				if (links[zielFuer]) {
					links[zielFuer].url = w.url;
					links[zielFuer].icon = w.icon;
					if (!links[zielFuer].label)
						links[zielFuer].label = ziele.find((z) => z.url === w.url)?.label ?? '';
				}
			}}
		/>
	</section>

	<section class="stapel eng" id="dokumente" aria-labelledby="ag-d">
		<h3 id="ag-d">Dokumente und Anleitungen</h3>
		<ul class="zeilen">
			{#each dokumente as d, i (d.id)}
				<li>
					<input
						aria-label="Titel von {d.name}"
						maxlength={HUB_GRENZEN.dokumentTitel}
						bind:value={d.title}
					/>
					<input
						aria-label="Ordner für {d.title}"
						placeholder="Ordner (optional)"
						list="abteilung-ordner"
						maxlength={HUB_GRENZEN.ordnerName}
						bind:value={d.ordner}
					/>
					<span class="knoepfe">
						<button
							type="button"
							class="knopf zweit mini"
							disabled={i === 0}
							aria-label="{d.title} nach oben"
							onclick={() => ([dokumente[i - 1], dokumente[i]] = [dokumente[i], dokumente[i - 1]])}
						>
							↑
						</button>
						<button
							type="button"
							class="knopf zweit klein"
							aria-label="{d.title} entfernen"
							onclick={() => dokumente.splice(i, 1)}
						>
							Entfernen
						</button>
					</span>
				</li>
			{/each}
		</ul>
		<datalist id="abteilung-ordner">
			{#each ordnerNamen as o (o)}<option value={o}></option>{/each}
		</datalist>
		{#key schluessel}
			<Anhaenge start={[]} max={20} legende="Datei hinzufügen" />
		{/key}
		<p class="hinweis unter">
			PDF, Bilder und Office-Dateien ohne Makros. Herunterladen geht nur nach Anmeldung. Entfernte
			Dateien werden beim Speichern gelöscht.
		</p>
	</section>

	<button class="knopf speichern" type="submit">
		Aufbau, Schnellzugriff und Dokumente speichern
	</button>
</form>

<style>
	h3 {
		margin: 0;
		font-size: 17px;
	}
	.eng {
		gap: 10px;
	}
	.unter {
		font-size: 13px;
		margin: 0;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 12px;
	}
	.zeilen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zeilen > li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zeilen > li.leer {
		color: var(--mu);
		font-size: 14px;
	}
	.zeilen input {
		flex: 1 1 160px;
		min-width: 0;
		width: auto;
	}
	.knoepfe {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.mini {
		min-height: 36px;
		min-width: 36px;
		padding: 0 8px;
	}
	.bereiche {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 16px;
	}
	.bereichstitel {
		display: block;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
		padding-bottom: 6px;
		border-bottom: 1px solid var(--bd);
	}
	.aufbauzeile {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 0;
		border-bottom: 1px solid var(--bd);
	}
	.aufbauzeile span {
		flex: 1;
		min-width: 0;
	}
	.aufbauzeile.fest span {
		color: var(--mu);
		min-height: 36px;
		display: flex;
		align-items: center;
	}
	.aufbauzeile span.aus {
		color: var(--mu);
	}
	.aufbauhinweis {
		margin: 8px 0 0;
		font-size: 13px;
	}
	.symbol {
		display: inline-grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
	}
	.ziel {
		position: relative;
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: inline-block;
	}
	.speichern {
		align-self: flex-start;
	}
</style>
