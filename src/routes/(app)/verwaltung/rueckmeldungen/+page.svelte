<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { resolve } from '$app/paths';

	let { data } = $props();
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	const STAENDE = [
		['offen', 'Offen'],
		['neu', 'Neu'],
		['in_arbeit', 'In Arbeit'],
		['erledigt', 'Erledigt'],
		['abgelehnt', 'Nicht umgesetzt'],
		['alle', 'Alle']
	];
	const link = (stand: string, art: string) => `?stand=${stand}${art ? `&art=${art}` : ''}`;
</script>

<svelte:head><title>Rückmeldungen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel">
	<a class="zurueck" href={resolve('/(app)/verwaltung')}>← Verwaltung</a>
	<h1>Rückmeldungen</h1>
	<nav class="pillen" aria-label="Stand">
		{#each STAENDE as [k, l] (k)}
			<a
				class="pille"
				href={link(k, data.filter.kind)}
				aria-current={data.filter.status === k ? 'true' : undefined}
			>
				{l}
			</a>
		{/each}
	</nav>
	<nav class="pillen" aria-label="Art">
		{#each [['', 'Fehler und Ideen'], ['fehler', 'Nur Fehler'], ['idee', 'Nur Ideen']] as [k, l] (k)}
			<a
				class="pille klein"
				href={link(data.filter.status, k)}
				aria-current={data.filter.kind === k ? 'true' : undefined}
			>
				{l}
			</a>
		{/each}
	</nav>

	{#if data.liste.length === 0}
		<p class="karte hinweis">Keine Rückmeldungen.</p>
	{:else}
		<ul class="karte liste">
			{#each data.liste as r (r.id)}
				<li>
					<a class="eintrag" href={resolve('/(app)/verwaltung/rueckmeldungen/[id]', { id: r.id })}>
						<span class="zeile">
							<span class="schild rand">{r.kind === 'fehler' ? 'Fehler' : 'Idee'}</span>
							<span class="schild">{r.statusLabel}</span>
							<span class="hinweis">
								{datum.format(r.createdAt)} · {r.author ?? 'Gelöschtes Konto'} · {r.tenant}
							</span>
						</span>
						<span class="text">{r.text.length > 160 ? `${r.text.slice(0, 160)} …` : r.text}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pille.klein {
		min-height: 38px;
		font-size: 14px;
	}
	.liste {
		list-style: none;
		margin: 0;
		display: grid;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.eintrag {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 0;
		color: var(--tx);
		text-decoration: none;
	}
	.eintrag:hover .text {
		text-decoration: underline;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
		align-items: center;
	}
</style>
