<script lang="ts">
	/** Auf „Neu“-Seiten: vorhandene eigene Entwürfe zum Weiterschreiben */
	import { resolve } from '$app/paths';
	import { ENTWURF_SEITEN, type EntwurfArt } from '#lib/entwuerfe.ts';

	let {
		art,
		entwuerfe
	}: { art: EntwurfArt; entwuerfe: { id: string; title: string; updatedAt: Date | string }[] } =
		$props();
	const MAX = 3;
	const fmt = new Intl.DateTimeFormat('de-DE', {
		timeZone: 'Europe/Berlin',
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
</script>

{#if entwuerfe.length}
	<section class="meldung entwuerfe" aria-labelledby="entwuerfe-titel">
		<h2 id="entwuerfe-titel">Deine Entwürfe</h2>
		<ul>
			{#each entwuerfe.slice(0, MAX) as e (e.id)}
				<li>
					<a href="{resolve(ENTWURF_SEITEN[art])}?entwurf={e.id}">{e.title || 'Ohne Titel'}</a>
					<span class="zeit">· gespeichert {fmt.format(new Date(e.updatedAt))} Uhr</span>
				</li>
			{/each}
		</ul>
		<a href={resolve('/(app)/entwuerfe')}>
			{entwuerfe.length > MAX ? `Alle ${entwuerfe.length} Entwürfe` : 'Entwürfe verwalten'}
		</a>
	</section>
{/if}

<style>
	.entwuerfe h2 {
		margin: 0 0 4px;
		font-size: 1rem;
	}
	ul {
		margin: 0 0 6px;
		padding-left: 1.2em;
	}
	li {
		margin: 2px 0;
	}
	.zeit {
		color: var(--mu);
		font-size: 14px;
	}
</style>
