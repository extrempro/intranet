<script lang="ts">
	/** Abschnitt „Videos“ auf den Seiten der Abteilungen und Hubs (Kap. 8.15). */
	import { resolve } from '$app/paths';
	import { STATUS_TEXT, zeitText } from '#lib/mediathek.ts';

	let {
		unitId,
		m,
		id = 'u-mediathek'
	}: {
		unitId: string;
		m: {
			videos: { id: string; title: string; status: string; durationSec: number }[];
			anzahl: number;
			darf: boolean;
		};
		id?: string;
	} = $props();
</script>

{#if m.videos.length || m.darf}
	<section {id} class="karte stapel" aria-labelledby="{id}-h">
		<h2 id="{id}-h">Videos</h2>
		{#if m.darf && m.videos.some((v) => v.status !== 'veroeffentlicht')}
			<p class="hinweis">
				Nicht veröffentlichte Videos sehen nur Personen mit dem Recht „Mediathek“.
			</p>
		{/if}
		{#if m.videos.length === 0}
			<p class="hinweis">Noch keine Videos.</p>
		{:else}
			<ul class="liste">
				{#each m.videos as v (v.id)}
					<li>
						<a
							href={v.status === 'veroeffentlicht'
								? resolve('/(app)/mediathek/[id]', { id: v.id })
								: resolve('/(app)/mediathek/[id]/bearbeiten', { id: v.id })}
						>
							{v.title}
						</a>
						<span class="hinweis">
							{v.status === 'veroeffentlicht'
								? zeitText(v.durationSec)
								: `${STATUS_TEXT[v.status]} · nicht veröffentlicht`}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="knoepfe">
			{#if m.anzahl}
				<a class="knopf zweit" href="{resolve('/(app)/mediathek')}?einheit={unitId}">
					Alle Videos ({m.anzahl})
				</a>
			{/if}
			{#if m.darf}
				<a class="knopf zweit" href="{resolve('/(app)/mediathek/neu')}?einheit={unitId}">
					Video hochladen
				</a>
			{/if}
		</div>
	</section>
{/if}

<style>
	h2 {
		margin: 0;
		font-size: 20px;
	}
	p {
		margin: 0;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
	}
	.liste a {
		font-weight: 600;
	}
	.liste .hinweis {
		white-space: nowrap;
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
