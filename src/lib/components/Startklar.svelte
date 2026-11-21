<script lang="ts">
	/** Startklar-Prüfung (Verwaltung → System), Anleitung: docs/inbetriebnahme.md */
	import type { Pruefpunkt } from '#lib/startklar.ts';

	let { punkte }: { punkte: Pruefpunkt[] } = $props();

	const offen = $derived(punkte.filter((p) => p.stufe === 'fehler' || p.stufe === 'warnung'));
	const fehler = $derived(punkte.filter((p) => p.stufe === 'fehler').length);
	const ZEICHEN = { ok: '✓', warnung: '!', fehler: '×', info: 'i' } as const;
	const WORT = { ok: 'In Ordnung', warnung: 'Hinweis', fehler: 'Fehler', info: 'Info' } as const;
</script>

<section class="karte stapel" aria-labelledby="h-startklar">
	<h2 id="h-startklar">Startklar</h2>
	<p class={['meldung', fehler ? 'fehler' : offen.length ? 'warnung' : '']} role="status">
		{#if !offen.length}
			Alles eingerichtet.
		{:else if fehler}
			{fehler === 1 ? '1 Fehler' : `${fehler} Fehler`}{offen.length > fehler
				? `, ${offen.length - fehler} ${offen.length - fehler === 1 ? 'Hinweis' : 'Hinweise'}`
				: ''}. Vor dem Start beheben.
		{:else}
			{offen.length === 1 ? '1 Hinweis' : `${offen.length} Hinweise`}.
		{/if}
	</p>
	<ul class="punkte">
		{#each punkte as p (p.id)}
			<li class={p.stufe}>
				<span class="zeichen" aria-hidden="true">{ZEICHEN[p.stufe]}</span>
				<div>
					<strong>{p.titel}</strong>
					<span class="sr-only">: {WORT[p.stufe]}</span>
					<p>{p.text}</p>
				</div>
				{#if p.link}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- feste Pfade der Verwaltung aus startklar.ts -->
					<a class="aktionslink" href={p.link}>Einstellen</a>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.punkte {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	li {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 12px;
		align-items: start;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	li:first-child {
		border-top: 0;
	}
	li p {
		margin: 2px 0 0;
		color: var(--mu);
		font-size: 0.93rem;
	}
	.zeichen {
		width: 24px;
		height: 24px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--sf);
		background: var(--mu);
	}
	.ok .zeichen {
		background: var(--ac);
	}
	.warnung .zeichen {
		background: var(--warn-tx);
	}
	.fehler .zeichen {
		background: var(--err-tx);
	}
</style>
