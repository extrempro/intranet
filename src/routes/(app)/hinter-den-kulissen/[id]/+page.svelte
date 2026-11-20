<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags -- Text ist serverseitig bereinigt */
	import { resolve } from '$app/paths';
	import Reaktionen from '#lib/components/Reaktionen.svelte';
	import { formatSize } from '#lib/format.ts';

	let { data, form } = $props();
	const b = $derived(data.post);
	const datum = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'Europe/Berlin' });
	let bild = $state(0);
	let loeschenFragen = $state(false);
</script>

<svelte:head><title>{b.title} · Hinter den Kulissen · Intranet</title></svelte:head>

<article class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/hinter-den-kulissen')}>← Hinter den Kulissen</a>
	<div>
		<h1>{b.title}</h1>
		<p class="hinweis">{b.unitName} · {b.tenantShort} · {datum.format(b.publishAt)}</p>
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if b.images.length}
		<figure class="galerie">
			<img
				src={resolve('/(app)/dateien/[id]', { id: b.images[bild].id })}
				alt="Foto {bild + 1} von {b.images.length} zu „{b.title}“"
			/>
			{#if b.images.length > 1}
				<div class="blaettern">
					<button
						class="knopf zweit klein"
						type="button"
						disabled={bild === 0}
						onclick={() => (bild -= 1)}
						aria-label="Vorheriges Foto"
					>
						‹
					</button>
					<span aria-live="polite">Foto {bild + 1} von {b.images.length}</span>
					<button
						class="knopf zweit klein"
						type="button"
						disabled={bild === b.images.length - 1}
						onclick={() => (bild += 1)}
						aria-label="Nächstes Foto"
					>
						›
					</button>
				</div>
			{/if}
		</figure>
	{/if}

	<div class="karte text">{@html b.bodyHtml}</div>

	{#if b.files.length}
		<section class="karte">
			<h2 class="klein-h">Dateien</h2>
			<ul class="dateien">
				{#each b.files as f (f.id)}
					<li>
						<a href={resolve('/(app)/dateien/[id]', { id: f.id })} target="_blank" rel="noopener">
							{f.name}
						</a>
						<span class="hinweis">{f.kind.toUpperCase()} · {formatSize(f.size)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<Reaktionen newsId={b.id} reaktionen={b.reactions} basis="/hinter-den-kulissen" />
	<p class="hinweis">
		Veröffentlicht ohne Freigabe. Abgebildete Personen haben zugestimmt (bestätigt beim Erstellen).
		Für: {b.targets.map((t) => t.name).join(', ')}
	</p>

	{#if b.canEdit}
		<div class="aktionen">
			<a
				class="knopf zweit"
				href={resolve('/(app)/hinter-den-kulissen/[id]/bearbeiten', { id: b.id })}
			>
				Bearbeiten
			</a>
			{#if loeschenFragen}
				<form method="POST" action="?/loeschen" class="aktionen">
					<span>Endgültig löschen?</span>
					<button class="knopf rot" type="submit">Ja, löschen</button>
					<button class="knopf zweit" type="button" onclick={() => (loeschenFragen = false)}>
						Abbrechen
					</button>
				</form>
			{:else}
				<button class="linkknopf" type="button" onclick={() => (loeschenFragen = true)}>
					Löschen
				</button>
			{/if}
		</div>
	{/if}
</article>

<style>
	.schmal {
		max-width: 820px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
	.galerie {
		margin: 0;
		display: grid;
		gap: 8px;
	}
	.galerie img {
		width: 100%;
		max-height: 520px;
		object-fit: contain;
		border-radius: 14px;
		background: var(--bg);
	}
	.blaettern {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}
	.text :global(p) {
		margin: 0 0 10px;
	}
	.klein-h {
		font-size: 1rem;
		margin: 0 0 6px;
	}
	.dateien {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.dateien li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
	}
	.rot {
		background: #b42318;
		border-color: #b42318;
	}
</style>
