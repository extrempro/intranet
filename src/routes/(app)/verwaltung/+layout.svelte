<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Ziele aus der festen Liste in verwaltung.ts */
	/**
	 * Verwaltung (Entwurf „admin“): Kopf mit Geltungsbereich, links die
	 * Navigation in Gruppen. Auf der Startseite der Verwaltung stehen die
	 * Gruppen als Liste; auf Handy und Tablet führt „Verwaltung“ zurück.
	 */
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { verwaltungFuer } from '#lib/verwaltung.ts';

	let { data, children } = $props();

	const gruppen = $derived(verwaltungFuer(data.systemAdmin));
	const startseite = $derived(page.url.pathname === '/verwaltung');
	const aktiv = $derived(page.url.pathname.split('/')[2] ?? '');
	const umfang = $derived(
		data.systemAdmin ? 'System-Admin · alle Mandanten' : `Mandanten-Admin · ${data.ich.mandant}`
	);
	const ZURUECK = 'M15 6l-6 6l6 6';
</script>

<div class="verwaltung">
	<div class="kopf">
		{#if startseite}
			<h1>Verwaltung</h1>
		{:else}
			<a class="zurueck" href="/verwaltung">
				<Icon d={ZURUECK} size={18} stroke={2} /><span>Verwaltung</span>
			</a>
		{/if}
		<span
			class="schild"
			title={data.systemAdmin
				? 'Du siehst alle Mandanten. Mandanten-Admins sehen nur ihren eigenen.'
				: 'Du siehst deinen Mandanten.'}
		>
			{umfang}
		</span>
	</div>

	{#if startseite}
		{@render children()}
	{:else}
		<div class="zweispaltig">
			<nav class="links" aria-label="Verwaltung">
				{#each gruppen as g (g.label)}
					<div class="gruppe">
						<span class="gruppenname">{g.label}</span>
						{#each g.seiten as s (s.key)}
							<a
								href="/verwaltung/{s.key}"
								class:an={aktiv === s.key}
								aria-current={aktiv === s.key ? 'page' : undefined}
							>
								<Icon d={s.icon} size={18} stroke={1.8} />
								<span class="name">{s.label}</span>
								{#if s.key === 'rueckmeldungen' && data.offeneRueckmeldungen}
									<span class="zahl" aria-label="{data.offeneRueckmeldungen} neu">
										{data.offeneRueckmeldungen}
									</span>
								{/if}
							</a>
						{/each}
					</div>
				{/each}
			</nav>
			<div class="inhalt">{@render children()}</div>
		</div>
	{/if}
</div>

<style>
	.verwaltung {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
	}
	h1 {
		margin: 0;
	}
	.zurueck {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 44px;
		font-size: 28px;
		font-weight: 700;
		color: var(--tx);
		text-decoration: none;
	}
	.zurueck :global(svg) {
		display: none;
	}
	.zweispaltig {
		display: flex;
		gap: 28px;
		align-items: flex-start;
	}
	.links {
		flex: none;
		width: 236px;
		position: sticky;
		top: 84px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.gruppe {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.gruppenname {
		padding: 0 12px 4px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.links a {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 40px;
		padding: 8px 12px;
		box-sizing: border-box;
		border-radius: 10px;
		color: var(--tx);
		text-decoration: none;
		font-size: 14px;
	}
	.links a :global(svg) {
		flex: none;
		color: var(--mu);
	}
	.links a:hover {
		background: var(--sf);
	}
	.links a.an {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}
	.links a.an :global(svg) {
		color: var(--ac);
	}
	.name {
		flex: 1;
	}
	.zahl {
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		box-sizing: border-box;
		border-radius: 999px;
		background: #f5a524;
		color: #3a2300;
		font-size: 12px;
		font-weight: 700;
		line-height: 22px;
		text-align: center;
	}
	.inhalt {
		flex: 1;
		min-width: 0;
	}
	/* Seitentitel der Unterseiten unter „Verwaltung“ etwas kleiner */
	.inhalt :global(h1) {
		font-size: 22px;
	}

	@media (max-width: 1023px) {
		.links {
			display: none;
		}
		.zurueck {
			font-size: 15px;
			font-weight: 600;
			color: var(--ac);
		}
		.zurueck :global(svg) {
			display: inline;
		}
	}
</style>
