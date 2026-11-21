<script lang="ts">
	import { resolve } from '$app/paths';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { ENTWURF_NAMEN, ENTWURF_SEITEN, ENTWURF_TAGE } from '#lib/entwuerfe.ts';

	let { data, form } = $props();
	const fmt = new Intl.DateTimeFormat('de-DE', {
		timeZone: 'Europe/Berlin',
		weekday: 'short',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
</script>

<svelte:head><title>Meine Entwürfe · Intranet</title></svelte:head>

<div class="stapel seite">
	<h1>Meine Entwürfe</h1>
	<p class="leise">
		Neue Neuigkeiten, Hub-Beiträge, Beiträge „Hinter den Kulissen“ und FAQs werden beim Schreiben
		automatisch als Entwurf gespeichert. Nur du siehst sie. Nach dem Veröffentlichen verschwindet
		der Entwurf; unveränderte Entwürfe werden nach {ENTWURF_TAGE} Tagen gelöscht.
	</p>
	{#if form?.geloescht}<p class="meldung" role="status">Entwurf gelöscht.</p>{/if}
	{#if data.entwuerfe.length}
		<ul class="liste">
			{#each data.entwuerfe as e (e.id)}
				<li class="karte eintrag">
					<div class="text">
						<a class="titel" href="{resolve(ENTWURF_SEITEN[e.art])}?entwurf={e.id}">
							{e.title || 'Ohne Titel'}
						</a>
						<span class="leise">
							{ENTWURF_NAMEN[e.art]}&nbsp;· gespeichert {fmt.format(new Date(e.updatedAt))} Uhr
						</span>
					</div>
					<div class="knoepfe">
						<a class="knopf zweit" href="{resolve(ENTWURF_SEITEN[e.art])}?entwurf={e.id}">
							Weiterschreiben
						</a>
						<MitFrage
							action="?/loeschen"
							knopf="Löschen"
							frage={{
								titel: 'Entwurf löschen?',
								text: `„${e.title || 'Ohne Titel'}“ wird endgültig gelöscht, samt hochgeladener Bilder und Anhänge.`,
								ja: 'Löschen',
								gefahr: true
							}}
						>
							{#snippet felder()}<input type="hidden" name="id" value={e.id} />{/snippet}
						</MitFrage>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="karte leer">Du hast keine Entwürfe.</p>
	{/if}
</div>

<style>
	.seite {
		max-width: 820px;
	}
	h1 {
		margin: 0;
	}
	.leise {
		color: var(--mu);
		margin: 0;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.eintrag {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
	}
	.text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.titel {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
	}
	.leer {
		margin: 0;
	}
</style>
