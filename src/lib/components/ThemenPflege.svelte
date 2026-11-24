<script lang="ts">
	/** Themen der Mediathek und FAQs (Kap. 8.15): anlegen, umbenennen, löschen, Vorschläge. */
	import { enhance } from '$app/forms';
	import MitFrage from '#lib/components/MitFrage.svelte';

	let {
		data,
		form,
		bereich
	}: {
		data: {
			themen: { id: string; name: string; videos: number; faqs: number }[];
			vorschlaege: { id: string; name: string; von: string | null }[];
		};
		form: { ergebnis?: string; fehler?: string } | null | undefined;
		/** Verwaltung oder Redaktion (Seitentitel) */
		bereich: string;
	} = $props();
	let bearbeite = $state<string | null>(null);
	const anzahl = (t: { videos: number; faqs: number }) =>
		[
			t.videos === 1 ? '1 Video' : `${t.videos} Videos`,
			t.faqs === 1 ? '1 FAQ' : `${t.faqs} FAQs`
		].join(' · ');
</script>

<svelte:head><title>Themen · {bereich} · Intranet</title></svelte:head>

<div class="stapel seite">
	<div class="stapel eng">
		<h1>Themen</h1>
		<p class="hinweis">
			Aus dieser Liste wählen alle, die Videos oder FAQs pflegen. Sie gilt für alle Mandanten.
			Umbenennen gilt überall; ein gelöschtes Thema verschwindet aus allen Videos und FAQs.
		</p>
	</div>
	{#if form && 'ergebnis' in form}<p class="meldung" role="status">{form.ergebnis}</p>{/if}
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if data.vorschlaege.length}
		<section class="karte stapel" aria-labelledby="h-vs">
			<h2 id="h-vs">Vorschläge</h2>
			<ul class="liste">
				{#each data.vorschlaege as v (v.id)}
					<li class="zeile">
						<span>
							<strong>{v.name}</strong>
							<span class="hinweis">· vorgeschlagen von {v.von ?? 'unbekannt'}</span>
						</span>
						<span class="reihe">
							<form method="POST" action="?/annehmen" use:enhance>
								<input type="hidden" name="id" value={v.id} />
								<button class="knopf" type="submit">Aufnehmen</button>
							</form>
							<form method="POST" action="?/ablehnen" use:enhance>
								<input type="hidden" name="id" value={v.id} />
								<button class="knopf zweit" type="submit">Ablehnen</button>
							</form>
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="karte stapel" aria-labelledby="h-neu">
		<h2 id="h-neu">Thema hinzufügen</h2>
		<form method="POST" action="?/anlegen" class="reihe unten" use:enhance>
			<label class="feld">
				<span>Name</span>
				<input name="name" required maxlength="60" />
			</label>
			<button class="knopf" type="submit">Hinzufügen</button>
		</form>
	</section>

	<section class="karte stapel" aria-labelledby="h-liste">
		<h2 id="h-liste">Alle Themen ({data.themen.length})</h2>
		{#if data.themen.length === 0}
			<p class="hinweis">Noch keine Themen.</p>
		{:else}
			<ul class="liste">
				{#each data.themen as t (t.id)}
					<li class="zeile">
						{#if bearbeite === t.id}
							<form
								method="POST"
								action="?/umbenennen"
								class="reihe unten"
								use:enhance={() =>
									async ({ update, result }) => {
										await update();
										if (result.type === 'success') bearbeite = null;
									}}
							>
								<input type="hidden" name="id" value={t.id} />
								<label class="feld">
									<span>Neuer Name für {t.name}</span>
									<input name="name" required maxlength="60" value={t.name} />
								</label>
								<button class="knopf" type="submit">Speichern</button>
								<button class="knopf zweit" type="button" onclick={() => (bearbeite = null)}>
									Abbrechen
								</button>
							</form>
						{:else}
							<span class="stapel null">
								<strong>{t.name}</strong>
								<span class="hinweis">{anzahl(t)}</span>
							</span>
							<span class="reihe">
								<button
									class="knopf zweit"
									type="button"
									aria-label="{t.name} umbenennen"
									onclick={() => (bearbeite = t.id)}
								>
									Umbenennen
								</button>
								<MitFrage
									action="?/loeschen"
									enhance
									knopf="Löschen"
									knopfKlasse="knopf zweit"
									knopfLabel="{t.name} löschen"
									frage={{
										titel: 'Thema löschen?',
										text: `„${t.name}“ wird bei ${anzahl(t)} entfernt. Die Videos und FAQs selbst bleiben erhalten.`,
										ja: 'Löschen',
										gefahr: true
									}}
								>
									{#snippet felder()}<input type="hidden" name="id" value={t.id} />{/snippet}
								</MitFrage>
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	p {
		margin: 0;
	}
	.eng {
		gap: 6px;
	}
	.null {
		gap: 0;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste > li {
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		flex-wrap: wrap;
	}
	.reihe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.reihe.unten {
		align-items: flex-end;
	}
</style>
