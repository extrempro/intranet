<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let anlegen = $state(false);
</script>

<svelte:head><title>Standorte · Verwaltung · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<h1>Standorte</h1>
		{#if !anlegen && !form?.fehler}
			<button class="knopf" type="button" onclick={() => (anlegen = true)}>Standort anlegen</button>
		{/if}
	</div>
	<p class="hinweis">
		Kantinen mit eigenem Betreiber. Speiseplan, Öffnungs- und Schließzeiten pflegt der Betreiber
		selbst über sein Betreiber-Konto.
	</p>

	{#if anlegen || form?.fehler}
		<form method="POST" action="?/anlegen" class="karte felder">
			<h2>Neuer Standort</h2>
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			{#if data.mandanten.length > 1}
				<label class="feld">
					<span>Mandant</span>
					<select name="mandant" value={form?.tenantId ?? data.mandanten[0]?.id}>
						{#each data.mandanten as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
					</select>
				</label>
			{:else}
				<input type="hidden" name="mandant" value={data.mandanten[0]?.id} />
			{/if}
			<label class="feld">
				<span>Name</span>
				<input
					name="name"
					required
					maxlength="80"
					value={form?.name ?? ''}
					placeholder="z. B. Kantine Oper"
				/>
			</label>
			<label class="feld">
				<span>Adresse, Gebäude <span class="optional">(optional)</span></span>
				<input name="adresse" maxlength="200" value={form?.address ?? ''} />
			</label>
			<div class="aktionen">
				<button class="knopf" type="submit">Anlegen</button>
				<a class="knopf zweit" href={resolve('/(app)/verwaltung/standorte')}>Abbrechen</a>
			</div>
		</form>
	{/if}

	{#if data.standorte.length === 0}
		<p class="hinweis">Noch keine Standorte.</p>
	{:else}
		<ul class="liste karte">
			{#each data.standorte as s (s.id)}
				<li>
					<a href={resolve('/(app)/verwaltung/standorte/[id]', { id: s.id })}>
						<strong>{s.name}</strong>
						<span class="hinweis">
							{[s.address, s.tenantName].filter(Boolean).join(' · ')} · {s.operators}
							{s.operators === 1 ? 'Betreiber-Konto' : 'Betreiber-Konten'}{#if !s.active}
								&nbsp;· deaktiviert{/if}
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
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
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
		text-decoration: underline;
	}
</style>
