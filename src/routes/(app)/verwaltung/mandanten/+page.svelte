<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>Mandanten · Verwaltung · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<h1>Mandanten</h1>
		{#if data.systemAdmin}
			<a class="knopf" href={resolve('/(app)/verwaltung/mandanten/neu')}>Mandant anlegen</a>
		{/if}
	</div>
	<p class="hinweis">
		Der Mandant einer Person ergibt sich immer aus der Domain ihrer E-Mail-Adresse.
	</p>

	<ul class="liste karte">
		{#each data.mandanten as m (m.id)}
			<li>
				<a href={resolve('/(app)/verwaltung/mandanten/[id]', { id: m.id })}>
					<span class="logo" style="background: {m.accent ?? '#0F6E56'}" aria-hidden="true">
						{m.shortName.slice(0, 3)}
					</span>
					<span>
						<strong>{m.name}</strong>{#if m.isMain}<span class="schild">Hauptmandant</span>{/if}<br
						/>
						<span class="hinweis">
							{m.domains.length
								? m.domains.join(', ')
								: 'noch keine Domain – niemand kann sich anmelden'}
						</span>
					</span>
				</a>
			</li>
		{:else}
			<li class="leer">Noch keine Mandanten.</li>
		{/each}
	</ul>
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
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
		gap: 12px;
		align-items: center;
		padding: 12px 16px;
		color: var(--tx);
		text-decoration: none;
	}
	.liste a:hover {
		background: var(--bg);
	}
	.leer {
		padding: 12px 16px;
	}
	.logo {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 13px;
		flex: none;
	}
	.schild {
		margin-left: 8px;
	}
</style>
