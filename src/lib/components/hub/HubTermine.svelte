<script lang="ts">
	/** Termine eines Hubs als Liste mit Datum und „In Kalender“. */
	import { resolve } from '$app/paths';
	import { timeLabel } from '#lib/calendar.ts';

	let {
		termine
	}: {
		termine: {
			id: string;
			title: string;
			date: string;
			allDay: boolean;
			startTime: string | null;
			endTime: string | null;
			place: string | null;
		}[];
	} = $props();
	const zeit = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
	const tagMonat = (iso: string) => {
		const d = new Date(`${iso}T12:00:00Z`);
		return {
			tag: d.getUTCDate(),
			monat: d.toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' }).replace('.', '')
		};
	};
</script>

<ul class="zeilen">
	{#each termine as t (t.id)}
		{@const d = tagMonat(t.date)}
		<li>
			<span class="datum" aria-hidden="true"><strong>{d.tag}</strong>{d.monat}</span>
			<span class="spalte">
				<a href={resolve('/(app)/kalender/[id]', { id: t.id })}>{t.title}</a>
				<span class="unter">
					<span class="sr-only">{zeit.format(new Date(`${t.date}T12:00:00Z`))},</span>{timeLabel(
						t
					)}{t.place ? ` · ${t.place}` : ''}
				</span>
			</span>
			<a
				class="knopf zweit klein"
				href={resolve('/(app)/kalender/[id]/ics', { id: t.id })}
				download
				aria-label="{t.title} in den Kalender übernehmen"
			>
				In Kalender
			</a>
		</li>
	{/each}
</ul>

<style>
	.zeilen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	li:first-child {
		border-top: 0;
	}
	.datum {
		flex: none;
		width: 52px;
		padding: 6px 0;
		border-radius: 12px;
		background: var(--tint);
		color: var(--ac);
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 12px;
		line-height: 1.2;
	}
	.datum strong {
		font-size: 18px;
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
		overflow-wrap: anywhere;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.klein {
		min-height: 40px;
		padding: 6px 14px;
		font-size: 14px;
	}
</style>
