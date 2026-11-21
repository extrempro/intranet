<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { actionUrl } from '#lib/action-url.ts';
	import { page } from '$app/state';
	import PdfAnsicht from '#lib/components/PdfAnsicht.svelte';
	import StandortWahl from '#lib/components/StandortWahl.svelte';
	import { closureRange, closureTitle, dayLabel, hoursSummary } from '#lib/canteen.ts';
	import { formatRange } from '#lib/plans.ts';
	import Icon from '#lib/components/Icon.svelte';
	const KALENDER =
		'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16';
	const HAUS =
		'M5 12l-2 0l9 -9l9 9l-2 0M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6';
	const ORT =
		'M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M17.66 16.66l-4.24 4.24a2 2 0 0 1 -2.83 0l-4.25 -4.24a8 8 0 1 1 11.31 0z';

	let { data, form } = $props();
	const a = $derived(data.ansicht);
	const datei = $derived(data.plan ? resolve('/(app)/dateien/[id]', { id: data.plan.fileId }) : '');
	const heuteZu = $derived(a?.closedToday || a?.activeClosure);
</script>

<svelte:head><title>Speiseplan · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<div>
				<h1>Speiseplan</h1>
				{#if data.plan}<p class="hinweis unterzeile">
						{data.plan.title} · {formatRange(data.plan.validFrom, data.plan.validUntil)}
					</p>{/if}
			</div>
			<form method="POST" action={actionUrl(page.url.search, 'favorit')} use:enhance>
				<button
					class="stern"
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
				>
					{data.favorit ? '★' : '☆'}
				</button>
			</form>
		</div>
		{#if data.meine.length}
			<a class="knopf zweit" href={resolve('/(app)/konto/standorte')}>Standorte ändern</a>
		{/if}
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if data.alle.length === 0}
		<p class="hinweis">Es ist noch kein Kantinen-Standort eingerichtet.</p>
	{:else if !a}
		<section class="karte">
			<p>Wähl deinen Standort, dann siehst du hier Speiseplan und Öffnungszeiten deiner Kantine.</p>
			<StandortWahl alle={data.alle} meine={[]} />
		</section>
	{:else}
		{#if data.meine.length > 1 || !data.meine.some((m) => m.id === a.id)}
			<nav class="pillen" aria-label="Standort wählen">
				{#each data.meine as l, i (l.id)}
					<a
						href="?standort={l.id}"
						class="pille"
						aria-current={l.id === a.id ? 'true' : undefined}
						title={i === 0 ? 'Hauptstandort' : undefined}
					>
						{#if i === 0}<Icon d={HAUS} size={14} stroke={2} /><span class="sr-only">
								Hauptstandort:
							</span>{/if}
						{l.name}
					</a>
				{/each}
				{#if !data.meine.some((m) => m.id === a.id)}
					<span class="pille" aria-current="true">{a.name}</span>
				{/if}
			</nav>
		{/if}

		{#if heuteZu}
			<div class="zu" role="alert">
				<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="12" r="9" /><path d="M5.7 5.7l12.6 12.6" />
				</svg>
				<div>
					{#if a.activeClosure}
						<strong>{closureTitle(a.activeClosure)}</strong>
						<span>{closureRange(a.activeClosure)}</span>
					{:else}
						<strong>Heute geschlossen</strong>
						<span>Heute, {dayLabel(a.today)}</span>
					{/if}
				</div>
			</div>
		{/if}
		{#each a.announced as c (c.id)}
			<p class="demnaechst" role="status">
				<Icon d={KALENDER} size={18} stroke={1.8} />
				<span><strong>Demnächst geschlossen:</strong> {closureRange(c)}</span>
			</p>
		{/each}

		<section class="karte info" aria-labelledby="h-kantine">
			<div class="links">
				{#if data.meine.some((m) => m.id === a.id)}<span class="marke">Mein Standort</span>{/if}
				<h2 id="h-kantine">{a.name}</h2>
				{#if a.address}<span class="hinweis">{a.address}</span>{/if}
				{#if a.note}<span class="hinweis">{a.note}</span>{/if}
				{#if a.contact}<span class="hinweis">Kontakt: {a.contact}</span>{/if}
			</div>
			<div class="rechts">
				<span class="status" class:offen={a.status.open}>
					<span class="punkt" aria-hidden="true"></span>{a.status.text}
				</span>
				<dl class="zeiten">
					{#each hoursSummary(a.hours) as z (z.days)}
						<dt>{z.days}</dt>
						<dd>{z.time}</dd>
					{/each}
				</dl>
				{#if a.place}<span class="lage">
						<Icon d={ORT} size={14} stroke={2} />{a.place}
					</span>{/if}
			</div>
		</section>

		{#if data.plan}
			<h2 class="sr-only">{data.plan.title}</h2>
			{#key data.plan.fileId}
				<PdfAnsicht
					src={datei}
					titel={data.plan.title}
					name={data.plan.fileName}
					download="{datei}?download"
				/>
			{/key}
		{:else}
			<p class="meldung" role="status">Für diese Woche liegt noch kein Speiseplan vor.</p>
		{/if}

		{#if a.upcoming.length || (a.current && data.plan?.id !== a.current.id)}
			<nav class="weitere" aria-label="Weitere Speisepläne">
				{#if a.current && data.plan?.id !== a.current.id}
					<a href="?standort={a.id}">Aktueller Speiseplan ({a.current.title})</a>
				{/if}
				{#each a.upcoming.filter((m) => m.id !== data.plan?.id) as m (m.id)}
					<a href="?standort={a.id}&plan={m.id}">
						Nächster Speiseplan: {m.title} (ab {dayLabel(m.validFrom)})
					</a>
				{/each}
			</nav>
		{/if}
	{/if}
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	h1 {
		margin: 0;
	}
	.unterzeile {
		margin: 2px 0 0;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.zu {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 16px 18px;
		border-radius: 16px;
		background: #fcebeb;
		border: 1px solid #f09595;
		border-left: 6px solid #b42318;
		color: #18201c;
	}
	.zu svg {
		flex: none;
		fill: none;
		stroke: #b42318;
		stroke-width: 2;
		stroke-linecap: round;
	}
	.zu div {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.zu strong {
		font-size: 20px;
		color: #b42318;
	}
	.zu span {
		font-weight: 600;
	}
	.demnaechst {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--tint);
	}
	.demnaechst :global(svg) {
		flex: none;
		color: var(--ac);
	}
	.info {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 12px 24px;
	}
	.links {
		flex: 1 1 260px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.marke {
		font-size: 12px;
		font-weight: 700;
		color: var(--ac);
	}
	.links h2 {
		margin: 0;
		font-size: 18px;
	}
	.rechts {
		flex: 0 1 260px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}
	.punkt {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--mu);
	}
	.status.offen .punkt {
		background: #12a150;
	}
	.zeiten {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 2px 12px;
		margin: 0;
	}
	.zeiten dt {
		font-weight: 600;
	}
	.zeiten dd {
		margin: 0;
	}
	.lage {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--mu);
	}
	.weitere {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.weitere a {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
</style>
