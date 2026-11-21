<script lang="ts">
	import { resolve } from '$app/paths';
	import { unitTypeLabel } from '#lib/roles.ts';

	let { data } = $props();
	let nurOhnePflege = $state(false);
	const liste = $derived(data.einheiten.filter((e) => !nurOhnePflege || e.managers === 0));
</script>

<svelte:head><title>Abteilungen und Hubs · Verwaltung · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<h1>Abteilungen und Hubs</h1>
		<a class="knopf" href={resolve('/(app)/verwaltung/abteilungen/neu')}>Einheit anlegen</a>
	</div>
	<label class="schalter">
		<input type="checkbox" bind:checked={nurOhnePflege} /> Nur ohne Pflege
	</label>

	{#if liste.length === 0}
		<p class="hinweis">Keine Einheiten.</p>
	{:else}
		<ul class="liste karte">
			{#each liste as e (e.id)}
				<li>
					<a href={resolve('/(app)/verwaltung/abteilungen/[id]', { id: e.id })}>
						<strong>{e.name}</strong>
						<span class="hinweis">
							{unitTypeLabel(e)} · {e.isCentral ? 'Zentral' : e.tenantName} · {e.members}
							{e.members === 1 ? 'Person' : 'Personen'}{#if e.managers === 0}
								&nbsp;· ohne Pflege{/if}{#if e.hidden}
								&nbsp;· ausgeblendet{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
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
	.schalter {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.schalter input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.liste a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 16px;
		color: var(--tx);
		text-decoration: none;
	}
	.liste a:hover {
		background: var(--bg);
	}
</style>
