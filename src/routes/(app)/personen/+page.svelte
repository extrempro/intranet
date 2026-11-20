<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import { livesuche } from '#lib/livesuche.ts';

	let { data } = $props();
</script>

<svelte:head><title>Personen · Organisation · Intranet</title></svelte:head>

<div class="stapel">
	<div>
		<h1>Personen</h1>
		<p class="untertitel">Ansprechpersonen in deinem Mandanten und in zentralen Einheiten.</p>
	</div>

	<form
		method="GET"
		class="filter"
		role="search"
		data-sveltekit-reset="false"
		data-sveltekit-replacestate
	>
		<label class="feld suche">
			<span class="sr-only">Personen suchen</span>
			<input
				use:livesuche
				type="search"
				name="q"
				value={data.q}
				maxlength="100"
				placeholder="Name, Position oder Abteilung suchen …"
				autocomplete="off"
			/>
		</label>
		{#if data.einheiten.length > 1}
			<label>
				<span class="sr-only">Abteilung</span>
				<select
					name="einheit"
					class="pille"
					class:an={!!data.unitId}
					value={data.unitId ?? ''}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				>
					<option value="">Abteilung: alle</option>
					{#each data.einheiten as u (u.id)}<option value={u.id}>{u.name}</option>{/each}
				</select>
			</label>
		{/if}
	</form>

	{#if data.personen.length === 0}
		<p class="karte hinweis" role="status">
			{data.q || data.unitId ? 'Niemand gefunden.' : 'Noch keine Personen.'}
		</p>
	{:else}
		<p class="hinweis" role="status">
			{data.mehr
				? `Mehr als ${data.personen.length} Personen – grenz die Suche ein.`
				: data.personen.length === 1
					? '1 Person'
					: `${data.personen.length} Personen`}
		</p>
		<ul class="liste">
			{#each data.personen as m (m.id)}
				<li>
					<Avatar name={m.name} foto={m.foto} groesse={44} />
					<div class="person">
						<a class="name" href={resolve('/(app)/personen/[id]', { id: m.id })}>{m.name}</a>
						{#if m.position || m.einheiten.length}
							<span class="unter">
								{m.position}{m.position && m.einheiten.length ? ' · ' : ''}
								{#each m.einheiten as u, i (u.id)}{i ? ', ' : ''}<a
										class="einheit"
										href={resolve('/(app)/abteilungen/[slug]', { slug: u.slug })}
									>
										{u.name}
									</a>{/each}
							</span>
						{/if}
						<span class="unter">
							<a href="mailto:{m.email}">{m.email}</a>
							{#if m.phone}· <a href="tel:{m.phone.replace(/[^0-9+]/g, '')}">{m.phone}</a>{/if}
							{#if m.room}· Raum {m.room}{/if}
						</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	h1 {
		margin: 0;
	}
	.untertitel {
		margin: 4px 0 0;
		color: var(--mu);
	}
	.filter {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.suche {
		flex: 1 1 300px;
		max-width: 560px;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.liste li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.person {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		font-weight: 700;
		color: var(--tx);
		text-decoration: underline;
		text-decoration-color: var(--bd);
		text-underline-offset: 4px;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
		overflow-wrap: anywhere;
	}
	.unter a {
		color: var(--mu);
	}
	.einheit {
		font-weight: 600;
	}
</style>
