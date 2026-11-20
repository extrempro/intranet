<script lang="ts">
	/** Abgleich mit Entra (Kap. 4.1): Zustand, „Jetzt abgleichen“, „Trotzdem abgleichen“. */
	import { onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Info from '#lib/components/Info.svelte';
	import type { SyncStatus } from '#lib/server/auth/entra-sync.ts';

	let {
		abgleich: e,
		fehler = null
	}: {
		abgleich: {
			eingerichtet: boolean;
			uhrzeit: string;
			laeuft: boolean;
			letzter: SyncStatus | null;
		};
		fehler?: string | null;
	} = $props();

	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
	const datum = (v: string) => zeit.format(new Date(v));

	// Läuft der Abgleich, alle 3 Sekunden nachsehen, bis er fertig ist
	let poll: ReturnType<typeof setInterval> | null = null;
	$effect(() => {
		if (e.laeuft && !poll) poll = setInterval(() => invalidateAll(), 3000);
		if (!e.laeuft && poll) {
			clearInterval(poll);
			poll = null;
		}
	});
	onDestroy(() => {
		if (poll) clearInterval(poll);
	});
	const zahlen = $derived(
		e.letzter
			? [
					[e.letzter.geprueft, 'geprüft'],
					[e.letzter.aktualisiert, 'Profil geändert'],
					[e.letzter.rollen, 'Rollen geändert'],
					[e.letzter.gesperrt, 'gesperrt'],
					[e.letzter.freigegeben, 'wieder freigegeben'],
					[e.letzter.fehler, 'Fehler']
				].filter(([n], i) => i === 0 || Number(n) > 0)
			: []
	);
</script>

<section class="karte stapel" aria-labelledby="h-entra">
	<h2 id="h-entra">
		Abgleich mit Entra
		<Info
			thema="Abgleich mit Entra"
			text="Gleicht jede Nacht Name, E-Mail, Mandant und Rollen aller Microsoft-Konten ab. In Entra gelöschte oder deaktivierte Konten und Personen ohne Zugangsgruppe werden gesperrt; werden sie in Entra wieder gültig, gibt der Abgleich sie frei. Von der Verwaltung gesperrte Konten bleiben gesperrt. Würde der Abgleich mehr als 10 % der Konten sperren, hält er an."
		/>
	</h2>
	{#if !e.eingerichtet}
		<p class="hinweis">Die Anmeldung mit Microsoft ist nicht eingerichtet.</p>
	{:else}
		{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
		{#if e.laeuft}
			<p class="meldung" role="status">Der Abgleich läuft …</p>
		{:else if e.letzter && !e.letzter.ok}
			<p class={['meldung', e.letzter.angehalten ? 'warnung' : 'fehler']} role="alert">
				{e.letzter.meldung}
			</p>
		{:else if e.letzter?.meldung}
			<p class="meldung warnung">{e.letzter.meldung}</p>
		{/if}
		<dl class="werte">
			<div>
				<dt>Letzter Abgleich</dt>
				<dd>
					{#if e.letzter}
						{datum(e.letzter.zeit)} · {e.letzter.ok
							? 'erfolgreich'
							: e.letzter.angehalten
								? 'angehalten'
								: 'fehlgeschlagen'} · {e.letzter.ausgeloest === 'hand'
							? 'von Hand'
							: 'nach Zeitplan'}
					{:else}noch nicht gelaufen{/if}
				</dd>
			</div>
			{#if e.letzter && zahlen.length}
				<div>
					<dt>Ergebnis</dt>
					<dd>{zahlen.map(([n, t]) => `${n} ${t}`).join(' · ')}</dd>
				</div>
			{/if}
			<div>
				<dt>Zeitplan</dt>
				<dd>täglich ab {e.uhrzeit} Uhr</dd>
			</div>
		</dl>
		<div class="aktionen">
			<form method="POST" action="?/abgleichen" use:enhance>
				<button class="knopf zweit" type="submit" disabled={e.laeuft}>Jetzt abgleichen</button>
			</form>
			{#if e.letzter?.angehalten && !e.laeuft}
				<form method="POST" action="?/abgleichen" use:enhance>
					<input type="hidden" name="trotzdem" value="ja" />
					<button class="knopf gefahr" type="submit">
						Trotzdem abgleichen ({e.letzter.angehalten.sperren} Konten sperren)
					</button>
				</form>
			{/if}
		</div>
		<p class="hinweis">
			Gesperrte Konten stehen im <a href={resolve('/(app)/verwaltung/protokoll')}>Protokoll</a>.
		</p>
	{/if}
</section>

<style>
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.werte {
		margin: 0;
		display: grid;
		gap: 10px;
	}
	.werte > div {
		display: grid;
		grid-template-columns: minmax(12rem, 16rem) 1fr;
		gap: 12px;
	}
	@media (max-width: 560px) {
		.werte > div {
			grid-template-columns: 1fr;
			gap: 2px;
		}
	}
	dt {
		color: var(--mu);
	}
	dd {
		margin: 0;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.gefahr {
		background: #b42318;
		border-color: #b42318;
		color: #fff;
	}
</style>
