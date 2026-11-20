<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Ziele aus der festen Liste in verwaltung.ts */
	import Icon from '#lib/components/Icon.svelte';
	import { verwaltungFuer } from '#lib/verwaltung.ts';

	let { data } = $props();
	const gruppen = $derived(verwaltungFuer(data.systemAdmin));
	const PFEIL = 'M9 6l6 6l-6 6';
</script>

<svelte:head><title>Verwaltung · Intranet</title></svelte:head>

<div class="gruppen">
	{#each gruppen as g (g.label)}
		<section aria-labelledby="g-{g.label}">
			<h2 id="g-{g.label}">{g.label}</h2>
			<ul class="liste">
				{#each g.seiten as s (s.key)}
					<li>
						<a href="/verwaltung/{s.key}">
							<span class="symbol" aria-hidden="true">
								<Icon d={s.icon} size={20} stroke={1.8} />
							</span>
							<span class="text">
								<strong>{s.label}</strong>
								<span class="unter">
									{s.key === 'rueckmeldungen' && data.offeneRueckmeldungen
										? `${data.offeneRueckmeldungen} neu`
										: s.text}
								</span>
							</span>
							<span class="pfeil" aria-hidden="true"><Icon d={PFEIL} size={18} stroke={2} /></span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.gruppen {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 18px 16px;
		align-items: start;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	h2 {
		margin: 0;
		padding: 0 4px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 18px;
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--bd);
	}
	a {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 64px;
		padding: 12px 16px;
		box-sizing: border-box;
		color: var(--tx);
		text-decoration: none;
	}
	a:hover {
		background: var(--bg);
	}
	.symbol {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--tint);
		color: var(--ac);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	strong {
		font-weight: 600;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.pfeil {
		flex: none;
		display: inline-flex;
		color: var(--mu);
	}
</style>
