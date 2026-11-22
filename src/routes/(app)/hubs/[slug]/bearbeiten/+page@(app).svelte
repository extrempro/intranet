<script lang="ts">
	import { resolve } from '$app/paths';
	import BildZuschnitt from '#lib/components/BildZuschnitt.svelte';
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import HubPflege from '#lib/components/HubPflege.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { ROLLEN } from '#lib/tours.ts';

	let { data, form } = $props();
	const h = $derived(data.hub);
	// Nach dem Speichern alles neu aus den Daten aufbauen
	let version = $state(0);
	const meldung = (bereich: string) =>
		form && 'bereich' in form && form.bereich === bereich
			? (form as { fehler?: string; ok?: string })
			: null;
	const BUCH =
		'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13';
</script>

<svelte:head><title>{h.name} bearbeiten · Hubs · Intranet</title></svelte:head>

<div class="stapel seite">
	{#if h.canManage}
		<EinfuehrungAngebot
			tour={ROLLEN.hub_team}
			text="Du pflegst diesen Hub. Eine kurze Einführung zeigt dir, wie du ihn gestaltest."
		/>
	{/if}
	<a class="zurueck" href={resolve('/(app)/hubs/[slug]', { slug: h.slug })}>← Zurück</a>
	<div class="titel">
		<h1 class="mit-hilfe">
			{h.name} bearbeiten
			{#if h.canManage}<EinfuehrungKnopf tour={ROLLEN.hub_team} />{/if}
		</h1>
		<p class="unter">
			{h.canManage
				? 'Nur für Mitglieder des Hub-Teams (Rolle Hub-Verwaltung), die Verwaltung und die Redaktion.'
				: 'Du pflegst die Dokumente dieses Hubs.'}
		</p>
		<a class="handbuch" href={resolve('/(app)/handbuch/[slug]', { slug: 'hub-pflegen' })}>
			<Icon d={BUCH} size={16} stroke={1.8} />Handbuch: Hubs pflegen
		</a>
	</div>

	{#key version}
		<HubPflege
			hub={h}
			pflege={data.pflege}
			meldung={meldung('seite')}
			ongespeichert={() => version++}
		/>
	{/key}

	{#if h.canManage}
		<section class="karte stapel" aria-labelledby="h-bilder" id="bilder">
			<h2 id="h-bilder">Titelbild und Symbol</h2>
			{#if meldung('bilder')?.fehler}<p class="meldung fehler" role="alert">
					{meldung('bilder')?.fehler}
				</p>{/if}
			{#if meldung('bilder')?.ok}<p class="meldung" role="status">{meldung('bilder')?.ok}</p>{/if}
			<div class="bilder">
				<section class="stapel eng" aria-labelledby="h-titelbild">
					<h3 id="h-titelbild">Titelbild</h3>
					<p class="unter">Breites Bild hinter dem Kopf der Hub-Seite (Format 4:1).</p>
					{#if h.coverUrl}
						<img class="titelbild" src={h.coverUrl} alt="" />
						<div>
							<MitFrage
								action="?/bildLoeschen"
								knopf="Titelbild entfernen"
								frage={{ titel: 'Titelbild entfernen?', ja: 'Entfernen', gefahr: true }}
							>
								{#snippet felder()}<input type="hidden" name="art" value="titelbild" />{/snippet}
							</MitFrage>
						</div>
					{/if}
					<BildZuschnitt
						aktion="?/bild"
						art="titelbild"
						verhaeltnis={4}
						minBreite={800}
						maxBreite={2000}
						beschriftung="Titelbild"
					/>
				</section>
				<section class="stapel eng" aria-labelledby="h-symbol">
					<h3 id="h-symbol">Symbol</h3>
					<p class="unter">Quadratisch, z. B. ein Logo. Neben dem Namen und in der Hub-Liste.</p>
					{#if h.iconUrl}
						<img class="symbolbild" src={h.iconUrl} alt="" />
						<div>
							<MitFrage
								action="?/bildLoeschen"
								knopf="Symbol entfernen"
								frage={{ titel: 'Symbol entfernen?', ja: 'Entfernen', gefahr: true }}
							>
								{#snippet felder()}<input type="hidden" name="art" value="symbol" />{/snippet}
							</MitFrage>
						</div>
					{/if}
					<BildZuschnitt
						aktion="?/bild"
						art="symbol"
						minBreite={128}
						maxBreite={512}
						beschriftung="Symbol"
					/>
				</section>
			</div>
		</section>
	{/if}

	{#if h.canAdminister}
		<section class="karte stapel" aria-labelledby="h-archiv">
			<h2 id="h-archiv">Archivieren</h2>
			{#if meldung('archiv')?.fehler}<p class="meldung fehler" role="alert">
					{meldung('archiv')?.fehler}
				</p>{/if}
			<p class="unter">
				Nur für die Verwaltung. Ein archivierter Hub ist nirgends mehr sichtbar und wird nach zwei
				Jahren gelöscht.
			</p>
			<div>
				<MitFrage
					action="?/archivieren"
					frage={{
						titel: `„${h.name}“ archivieren?`,
						text: 'Der Hub ist danach nirgends mehr sichtbar und wird nach zwei Jahren gelöscht.',
						ja: 'Archivieren',
						gefahr: true
					}}
				>
					{#snippet ausloeser(klick: () => void)}
						<button class="knopf zweit" type="button" onclick={klick}>Hub archivieren</button>
					{/snippet}
				</MitFrage>
			</div>
		</section>
	{/if}
</div>

<style>
	.seite {
		max-width: 900px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		font-weight: 600;
	}
	.titel {
		display: grid;
		gap: 6px;
		justify-items: start;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 18px;
	}
	h3 {
		font-size: 16px;
	}
	.unter {
		margin: 0;
		font-size: 14px;
		color: var(--mu);
	}
	.handbuch {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		padding: 4px 12px;
		border: 1px solid var(--bd);
		border-radius: 999px;
		background: var(--sf);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.eng {
		gap: 8px;
	}
	.bilder {
		display: grid;
		gap: 20px;
	}
	.titelbild {
		width: 100%;
		aspect-ratio: 4 / 1;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid var(--bd);
	}
	.symbolbild {
		width: 72px;
		height: 72px;
		border-radius: 14px;
		border: 1px solid var(--bd);
	}
</style>
