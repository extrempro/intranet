<script lang="ts">
	import { animierteBilder } from '#lib/animiert.ts';
	import { resolve } from '$app/paths';
	import Absender from '#lib/components/Absender.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import LinkKopieren from '#lib/components/LinkKopieren.svelte';
	import Reaktionen from '#lib/components/Reaktionen.svelte';
	import { formatDay, formatWhen } from '#lib/news.ts';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import Umfrage from '#lib/components/Umfrage.svelte';

	let { data, form } = $props();
	const b = $derived(data.beitrag);
	const WARN =
		'M12 9v4M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0zM12 16h.01';
	const UHR = 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 7v5l3 3';
	const groesse = (b: number) =>
		b < 1024 * 1024
			? `${Math.max(1, Math.round(b / 1024))} KB`
			: `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
</script>

<svelte:head><title>{b.title} · Neuigkeiten · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/neuigkeiten')}>← Neuigkeiten</a>

	<article class="stapel">
		<div class="kopf">
			<div class="schilder">
				{#if b.pinned}<span class="schild">Angeheftet</span>{/if}
				{#if b.urgent && b.urgentUntil}<span class="schild rot">Dringend</span>{/if}
				{#if b.planned}<span class="schild warn">
						Geplant · erscheint {formatWhen(b.publishAt)}
					</span>{/if}
				{#if b.audience}<span class="schild">{b.audience}</span>{/if}
			</div>
			<LinkKopieren />
		</div>
		<h1>{b.title}</h1>
		<Absender
			name={b.sender.name}
			label={b.sender.label}
			slug={b.sender.slug}
			hub={b.sender.hub}
			wann={b.planned ? `erscheint am ${formatWhen(b.publishAt)}` : formatWhen(b.publishAt)}
		/>
		{#if b.urgent && b.urgentUntil}
			<section class="banner" aria-label="Dringende Meldung">
				<span class="warnsymbol" aria-hidden="true">
					<Icon d={WARN} size={20} stroke={2} />
				</span>
				<div class="stapel eng">
					<strong class="rot-text">Dringende Meldung · bis {formatWhen(b.urgentUntil)}</strong>
					{#if b.urgentText}<p class="banner-text">{b.urgentText}</p>{/if}
					<span class="hinweis">Danach erscheint der Beitrag wieder als normale Neuigkeit.</span>
				</div>
			</section>
		{/if}
		{#if b.wasUrgent && b.urgentUntil}
			<p class="war" role="note">
				<Icon d={UHR} size={16} stroke={2} />
				Dieser Beitrag war bis {formatWhen(b.urgentUntil)} eine dringende Meldung.
			</p>
		{/if}
		<!-- Inhalt ist serverseitig bereinigt (src/lib/server/html.ts) -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div use:animierteBilder class="karte text">{@html b.bodyHtml}</div>
		{#if b.attachments.length}
			<section aria-labelledby="h-anhaenge" class="karte">
				<h2 id="h-anhaenge" class="klein">Anhänge</h2>
				<ul class="anhaenge">
					{#each b.attachments as a (a.id)}
						<li>
							<span class="datei">
								<a
									href={resolve('/(app)/dateien/[id]', { id: a.id })}
									target="_blank"
									rel="noopener"
								>
									{a.name}
								</a>
								<span class="hinweis">· {groesse(a.size)}</span>
								{#if a.description}<span class="beschreibung">{a.description}</span>{/if}
							</span>
							<a
								class="knopf zweit klein-knopf"
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
		{#if data.umfrage && !b.planned}
			<Umfrage
				u={data.umfrage}
				newsId={b.id}
				fehlend={form && 'umfrageFehlend' in form ? (form.umfrageFehlend as string[]) : []}
				gesendet={!!(form && 'umfrageGesendet' in form)}
			/>
		{/if}
		{#if b.expiresAt}<p class="hinweis">Sichtbar bis {formatDay(b.expiresAt)}</p>{/if}
		{#if !b.planned}
			<div class="reaktionen">
				<Reaktionen newsId={b.id} reaktionen={b.reactions} hinweis />
			</div>
		{/if}
	</article>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if b.canEdit}
		<div class="aktionen">
			<a class="knopf zweit" href={resolve('/(app)/neuigkeiten/[id]/bearbeiten', { id: b.id })}>
				Bearbeiten
			</a>
			<MitFrage
				action="?/loeschen"
				knopf="Löschen"
				frage={{
					titel: 'Beitrag löschen?',
					text: 'Der Beitrag wird samt Anhängen endgültig gelöscht.',
					ja: 'Löschen',
					gefahr: true
				}}
			/>
		</div>
	{/if}
</div>

<style>
	.seite {
		max-width: 820px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.kopf .schilder {
		flex: 1 1 auto;
	}
	h1 {
		margin: 0;
		font-size: 30px;
		line-height: 1.25;
	}
	.schild.rot {
		background: var(--rot);
		color: #fff;
	}
	.schild.warn {
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.banner {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		border-radius: 14px;
		background: var(--err-bg);
		border: 2px solid var(--err-bd);
	}
	.warnsymbol {
		flex: none;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--rot);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.eng {
		gap: 4px;
	}
	.rot-text {
		font-size: 13px;
		color: var(--err-tx);
	}
	.banner-text {
		margin: 0;
		font-weight: 600;
		line-height: 1.5;
	}
	.war {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--bg);
		border: 1px solid var(--bd);
		font-size: 14px;
		color: var(--mu);
	}
	.reaktionen {
		padding-top: 14px;
		border-top: 1px solid var(--bd);
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.text :global(p) {
		margin: 0 0 12px;
	}
	.text :global(p:last-child) {
		margin-bottom: 0;
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
		font-size: 18px;
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
		gap: 8px;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
	}
	.datei {
		overflow-wrap: anywhere;
	}
	.beschreibung {
		display: block;
		color: var(--mu);
		font-size: 0.93rem;
	}
	.klein-knopf {
		min-height: 36px;
		padding: 6px 12px;
		font-size: 13px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
</style>
