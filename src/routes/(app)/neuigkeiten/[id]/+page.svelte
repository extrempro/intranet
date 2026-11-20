<script lang="ts">
	import { resolve } from '$app/paths';
	import Reaktionen from '#lib/components/Reaktionen.svelte';
	import { formatDay, formatWhen } from '#lib/news.ts';

	let { data, form } = $props();
	const b = $derived(data.beitrag);
	let loeschenFragen = $state(false);
	const groesse = (b: number) =>
		b < 1024 * 1024
			? `${Math.max(1, Math.round(b / 1024))} KB`
			: `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
</script>

<svelte:head><title>{b.title} · Neuigkeiten · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/neuigkeiten')}>← Neuigkeiten</a>

	{#if b.urgent && b.urgentUntil}
		<div class="banner" role="note">
			<strong>Dringende Meldung · bis {formatWhen(b.urgentUntil)}</strong>
			<span>{b.urgentText}</span>
		</div>
	{/if}

	<article class="stapel">
		<p class="hinweis">
			<strong>{b.sender.name}</strong> · {b.sender.label} ·
			{#if b.planned}erscheint am {formatWhen(b.publishAt)}{:else}{formatWhen(b.publishAt)}{/if}
		</p>
		<h1>{b.title}</h1>
		<div class="schilder">
			{#if b.pinned}<span class="schild">Angeheftet</span>{/if}
			{#if b.planned}<span class="schild rand">Geplant</span>{/if}
			{#if b.audience}<span class="schild rand">{b.audience}</span>{/if}
			{#if b.expiresAt}<span class="schild rand">sichtbar bis {formatDay(b.expiresAt)}</span>{/if}
		</div>
		{#if b.wasUrgent && b.urgentUntil}
			<p class="meldung">
				Dieser Beitrag war bis {formatWhen(b.urgentUntil)} eine dringende Meldung.
			</p>
		{/if}
		<!-- Inhalt ist serverseitig bereinigt (src/lib/server/html.ts) -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="text">{@html b.bodyHtml}</div>
		{#if b.attachments.length}
			<section aria-labelledby="h-anhaenge" class="karte">
				<h2 id="h-anhaenge" class="klein">Anhänge</h2>
				<ul class="anhaenge">
					{#each b.attachments as a (a.id)}
						<li>
							<a href={resolve('/(app)/dateien/[id]', { id: a.id })} target="_blank" rel="noopener">
								{a.name}
							</a>
							<span class="hinweis">{a.kind.toUpperCase()} · {groesse(a.size)}</span>
							<a
								class="laden"
								href="{resolve('/(app)/dateien/[id]', { id: a.id })}?download"
								download
								aria-label="{a.name} herunterladen"
							>
								Herunterladen
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		{#if !b.planned}<Reaktionen newsId={b.id} reaktionen={b.reactions} />{/if}
	</article>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if b.canEdit}
		<div class="aktionen">
			<a class="knopf zweit" href={resolve('/(app)/neuigkeiten/[id]/bearbeiten', { id: b.id })}>
				Bearbeiten
			</a>
			{#if loeschenFragen}
				<form
					method="POST"
					action="?/loeschen"
					class="frage"
					role="group"
					aria-label="Löschen bestätigen"
				>
					<span>Beitrag endgültig löschen?</span>
					<button class="knopf loeschen" type="submit">Ja, löschen</button>
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
</div>

<style>
	.seite {
		max-width: 46rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.banner {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 16px;
		border-radius: 14px;
		background: var(--err-bg);
		border: 2px solid var(--err-bd);
		color: var(--err-tx);
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.text :global(h2) {
		font-size: 1.25rem;
	}
	.text :global(blockquote) {
		margin: 0;
		padding-left: 14px;
		border-left: 3px solid var(--bd);
		color: var(--mu);
	}
	.klein {
		font-size: 1rem;
		margin: 0 0 6px;
	}
	.anhaenge {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.anhaenge li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		align-items: center;
		min-height: 44px;
		border-bottom: 1px solid var(--bd);
	}
	.anhaenge li > a:first-child {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.laden {
		margin-left: auto;
	}
	.aktionen,
	.frage {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.loeschen {
		background: #b42318;
		border-color: #b42318;
	}
</style>
