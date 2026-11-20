<script lang="ts">
	import { livesuche } from '#lib/livesuche.ts';
	import { resolve } from '$app/paths';

	let { data } = $props();
	const STATUS = { active: '', invited: 'eingeladen', disabled: 'gesperrt' } as const;
</script>

<svelte:head><title>Benutzer und Rollen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel">
	<h1>Benutzer und Rollen</h1>
	<form method="GET" class="suche" data-sveltekit-reset="false" data-sveltekit-replacestate>
		<label class="feld">
			<span class="sr-only">Name oder E-Mail suchen</span>
			<input
				use:livesuche
				type="search"
				name="q"
				value={data.q}
				placeholder="Name oder E-Mail suchen"
			/>
		</label>
	</form>

	{#if data.personen.length === 0}
		<p class="hinweis" role="status">Niemand gefunden.</p>
	{:else}
		<ul class="liste karte">
			{#each data.personen as x (x.id)}
				<li>
					<a href={resolve('/(app)/verwaltung/benutzer/[id]', { id: x.id })}>
						<strong>{x.name}</strong>
						<span class="hinweis">
							{x.email} · {x.tenantName} · {x.authSource === 'entra'
								? 'Microsoft'
								: 'lokal'}{#if x.roles}
								· {x.roles}
								{x.roles === 1 ? 'Rolle' : 'Rollen'}{/if}{#if STATUS[x.status]}
								· <span class="schild rand">{STATUS[x.status]}</span>{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
		{#if data.personen.length === 200}<p class="hinweis">
				Nur die ersten 200 – grenz die Suche ein.
			</p>{/if}
	{/if}
</div>

<style>
	.suche {
		display: flex;
		gap: 10px;
		align-items: flex-end;
	}
	.suche .feld {
		flex: 1;
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
