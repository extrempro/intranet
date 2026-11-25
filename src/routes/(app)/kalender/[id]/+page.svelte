<script lang="ts">
	import { resolve } from '$app/paths';
	import { dayHeading, timeLabel } from '#lib/calendar.ts';
	import { berlinNow } from '#lib/canteen.ts';
	import MitFrage from '#lib/components/MitFrage.svelte';

	let { data, form } = $props();
	const t = $derived(data.termin);
	const heute = berlinNow().date;
	const zielgruppe = $derived(
		t.teamScope
			? `Intern: nur Team ${t.unitName}${t.teamScope === 'stamm' ? ' (Stammabteilung)' : ''}`
			: t.allTenants
				? 'Alle Mandanten'
				: t.targets.length
					? t.targets.map((x) => x.name).join(', ')
					: `Nur ${t.tenantShort}`
	);
</script>

<svelte:head><title>{t.title} · Kalender · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href="{resolve('/(app)/kalender')}?tag={t.date}">← Kalender</a>
	<div>
		<h1>{t.title}</h1>
		<p class="hinweis">{t.unitName} · {t.tenantShort}</p>
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<section class="karte">
		<dl class="angaben">
			<dt>Wann</dt>
			<dd>{dayHeading(t.date, heute)} · {timeLabel(t)}</dd>
			{#if t.place}<dt>Ort</dt>
				<dd>{t.place}</dd>{/if}
			<dt>Absender</dt>
			<dd>{t.unitName}</dd>
			<dt>Für</dt>
			<dd>{zielgruppe}</dd>
		</dl>
		{#if t.description}<p class="beschreibung">{t.description}</p>{/if}
	</section>

	<div class="aktionen">
		<a class="knopf zweit" href={resolve('/(app)/kalender/[id]/ics', { id: t.id })} download>
			In Kalender
		</a>
		{#if t.canEdit}
			<a class="knopf zweit" href={resolve('/(app)/kalender/[id]/bearbeiten', { id: t.id })}>
				Bearbeiten
			</a>
			<MitFrage
				action="?/loeschen"
				knopf="Löschen"
				frage={{
					titel: `„${t.title}“ löschen?`,
					text: 'Der Termin wird endgültig gelöscht.',
					ja: 'Löschen',
					gefahr: true
				}}
			/>
		{/if}
	</div>
</div>

<style>
	.schmal {
		max-width: 760px;
	}
	h1 {
		margin: 0;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.angaben {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 6px 16px;
		margin: 0;
	}
	.angaben dt {
		font-weight: 600;
	}
	.angaben dd {
		margin: 0;
	}
	.beschreibung {
		margin: 14px 0 0;
		white-space: pre-line;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
</style>
