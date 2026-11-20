<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatSize as groesse } from '#lib/format.ts';
	import { formatRange, planState } from '#lib/plans.ts';

	let { data, form } = $props();
	const ZUSTAND = { aktuell: 'aktuell', kuenftig: 'kommt', abgelaufen: 'abgelaufen' } as const;
</script>

<svelte:head><title>Pläne (KBB) · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Pläne (KBB)</h1>
			<form method="POST" action="?/favorit" use:enhance>
				<button
					class="stern"
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
				>
					{data.favorit ? '★' : '☆'}
				</button>
			</form>
		</div>
		{#if data.gewaehlt?.darfPflegen}
			<a class="knopf" href="{resolve('/(app)/plaene/neu')}?kbb={data.gewaehlt.unitId}">
				PDF hochladen
			</a>
		{/if}
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if data.kbbs.length === 0}
		<p class="hinweis">
			Es ist noch kein KBB eingerichtet. Das geht unter Verwaltung → Abteilungen und Hubs („KBB
			dieses Mandanten“).
		</p>
	{:else}
		<nav class="pillen" aria-label="KBB wählen">
			{#each data.kbbs as k (k.unitId)}
				<a
					href="?kbb={k.unitId}"
					class="pille"
					aria-current={data.gewaehlt?.unitId === k.unitId ? 'true' : undefined}
				>
					{k.unitName}{#if k.eigener}
						· dein Mandant{:else}
						· {k.tenantName}{/if}
				</a>
			{/each}
		</nav>

		{#if data.plaene.length === 0}
			<p class="hinweis" role="status">Für dieses KBB gibt es gerade keine Pläne.</p>
		{:else}
			<ul class="liste karte">
				{#each data.plaene as plan (plan.id)}
					{@const z = planState(plan, data.heute)}
					<li class:alt={z === 'abgelaufen'}>
						<a href={resolve('/(app)/plaene/[id]', { id: plan.id })}>
							<strong>{plan.title}</strong>
							<span class="hinweis">
								gültig {formatRange(plan.validFrom, plan.validUntil)} · PDF · {groesse(plan.size)}
							</span>
						</a>
						<span class="schild" class:rand={z !== 'aktuell'}>{ZUSTAND[z]}</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pille {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		text-decoration: none;
		font-weight: 600;
	}
	.pille[aria-current='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-right: 16px;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.liste li.alt {
		opacity: 0.75;
	}
	.liste a {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 16px;
		color: var(--tx);
		text-decoration: none;
	}
	.liste a:hover {
		text-decoration: underline;
	}
</style>
