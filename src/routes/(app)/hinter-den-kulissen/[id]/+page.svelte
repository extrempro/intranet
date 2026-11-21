<script lang="ts">
	/* eslint-disable svelte/no-at-html-tags -- Text ist serverseitig bereinigt */
	import { resolve } from '$app/paths';
	import Absender from '#lib/components/Absender.svelte';
	import Karussell from '#lib/components/Karussell.svelte';
	import LinkKopieren from '#lib/components/LinkKopieren.svelte';
	import Reaktionen from '#lib/components/Reaktionen.svelte';
	import { formatSize } from '#lib/format.ts';

	let { data, form } = $props();
	const b = $derived(data.post);
	const datum = new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeZone: 'Europe/Berlin' });
	let loeschenFragen = $state(false);
</script>

<svelte:head><title>{b.title} · Hinter den Kulissen · Intranet</title></svelte:head>

<article class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/hinter-den-kulissen')}>← Hinter den Kulissen</a>
	<div class="stapel eng">
		<span class="rubrik">Hinter den Kulissen</span>
		<h1>{b.title}</h1>
		<Absender
			name={b.unitName}
			label={b.unitLabel}
			slug={b.unitSlug}
			hub={b.unitType === 'hub'}
			wann={datum.format(b.publishAt)}
		/>
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if b.images.length}<Karussell bilder={b.images} titel={b.title} />{/if}

	<div class="text">{@html b.bodyHtml}</div>

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

	<div class="trenner">
		<Reaktionen newsId={b.id} reaktionen={b.reactions} basis="/hinter-den-kulissen" hinweis />
	</div>
	<div class="trenner zeile">
		{#if b.unitSlug}
			<a
				class="knopf zweit"
				href={b.unitType === 'hub'
					? resolve('/(app)/hubs/[slug]', { slug: b.unitSlug })
					: resolve('/(app)/abteilungen/[slug]', { slug: b.unitSlug })}
			>
				Mehr über {b.unitName}
			</a>
		{/if}
		<span class="schieben"></span>
		<LinkKopieren />
	</div>
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
	.eng {
		gap: 6px;
	}
	.rubrik {
		font-size: 13px;
		font-weight: 700;
		color: var(--ac);
	}
	h1 {
		font-size: 30px;
		line-height: 1.25;
	}
	.text {
		font-size: 17px;
		line-height: 1.6;
	}
	.trenner {
		padding-top: 14px;
		border-top: 1px solid var(--bd);
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.schieben {
		flex: 1;
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
	.rot {
		background: #b42318;
		border-color: #b42318;
	}
</style>
