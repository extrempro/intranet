<script lang="ts">
	/** Video ansehen (Kap. 8.15). */
	import { resolve } from '$app/paths';
	import VideoPlayer from '#lib/components/VideoPlayer.svelte';
	import { zeitText } from '#lib/mediathek.ts';

	let { data } = $props();
	const v = $derived(data.v);
	let zeit = $state(0);
	let player = $state<VideoPlayer>();
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	const aktuell = $derived(
		v.chapters.reduce((a: number, k: { s: number }, i: number) => (zeit >= k.s ? i : a), -1)
	);
	const einheitPfad = $derived(
		v.unit.type === 'hub'
			? resolve('/(app)/hubs/[slug]', { slug: v.unit.slug })
			: resolve('/(app)/abteilungen/[slug]', { slug: v.unit.slug })
	);
</script>

<svelte:head><title>{v.title} · Mediathek · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/mediathek')}>← Mediathek</a>
	{#if v.status !== 'veroeffentlicht'}
		<p class="meldung warnung">Entwurf: Das Video sehen nur Personen mit dem Recht „Mediathek“.</p>
	{/if}
	<div class="zweispaltig">
		<div class="stapel">
			{#key v.id}
				<VideoPlayer
					bind:this={player}
					bind:zeit
					titel={v.title}
					quelle="/mediathek/{v.id}/medien/master.m3u8"
					vorschau="/mediathek/{v.id}/medien/vorschau.jpg"
					untertitel={v.hatUntertitel ? `/mediathek/${v.id}/untertitel.vtt` : null}
					kapitel={v.chapters.length ? `/mediathek/${v.id}/kapitel.vtt` : null}
				/>
			{/key}
			<div class="titelzeile">
				<div class="stapel eng">
					<h1>{v.title}</h1>
					<span class="hinweis">
						<a href={einheitPfad}>{v.unit.name}</a> · {zeitText(v.durationSec)}{v.publishedAt
							? ` · ${datum.format(new Date(v.publishedAt))}`
							: ''}
						{v.mandanten.length ? ` · nur ${v.mandanten.map((m) => m.name).join(', ')}` : ''}
					</span>
				</div>
				{#if v.darf}
					<a class="knopf zweit" href={resolve('/(app)/mediathek/[id]/bearbeiten', { id: v.id })}>
						Bearbeiten
					</a>
				{/if}
			</div>
			{#if v.themen.length}
				<div class="themen">
					{#each v.themen as t (t.id)}<span class="thema">{t.name}</span>{/each}
				</div>
			{/if}
			{#if v.description}<p class="beschreibung">{v.description}</p>{/if}
		</div>
		<aside class="stapel">
			{#if v.chapters.length}
				<section class="karte stapel eng" aria-labelledby="h-kap">
					<h2 id="h-kap">Kapitel</h2>
					<ol class="kapitel">
						{#each v.chapters as k, i (i)}
							<li>
								<button
									type="button"
									class:an={aktuell === i}
									aria-current={aktuell === i ? 'true' : undefined}
									onclick={() => player?.springen(k.s)}
								>
									<span class="zeit">{zeitText(k.s)}</span>{k.t}
								</button>
							</li>
						{/each}
					</ol>
				</section>
			{/if}
			{#if data.mehr.length}
				<section class="karte stapel eng" aria-labelledby="h-mehr">
					<h2 id="h-mehr">Mehr von {v.unit.name}</h2>
					<ul class="mehr">
						{#each data.mehr as m (m.id)}
							<li>
								<a href={resolve('/(app)/mediathek/[id]', { id: m.id })}>{m.title}</a>
								<span class="hinweis">{zeitText(m.durationSec)}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</aside>
	</div>
</div>

<style>
	.seite {
		max-width: 76rem;
	}
	h1,
	h2 {
		margin: 0;
	}
	h1 {
		font-size: 1.5rem;
	}
	h2 {
		font-size: 1.05rem;
	}
	p {
		margin: 0;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
	}
	.eng {
		gap: 4px;
	}
	.zweispaltig {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 24px;
		align-items: start;
	}
	@media (max-width: 1099px) {
		.zweispaltig {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.titelzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.beschreibung {
		white-space: pre-line;
	}
	.themen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.thema {
		font-size: 12px;
		font-weight: 600;
		border-radius: 999px;
		padding: 2px 10px;
		background: var(--tint);
		color: var(--ac);
	}
	.kapitel,
	.mehr {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.kapitel button {
		display: flex;
		gap: 10px;
		width: 100%;
		min-height: 44px;
		align-items: center;
		padding: 6px 10px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.kapitel button.an {
		background: var(--tint);
		font-weight: 700;
	}
	.zeit {
		font-size: 13px;
		color: var(--mu);
		min-width: 44px;
		font-variant-numeric: tabular-nums;
	}
	.mehr li {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 0;
		border-top: 1px solid var(--bd);
	}
</style>
