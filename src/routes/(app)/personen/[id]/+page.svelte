<script lang="ts">
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';

	let { data } = $props();
	const x = $derived(data.person);
	const abteilungen = $derived(x.einheiten.filter((e) => e.hatSeite));
	const hubs = $derived(x.einheiten.filter((e) => !e.hatSeite));
</script>

<svelte:head><title>{x.name} · Intranet</title></svelte:head>

<div class="stapel seite">
	<div class="kopf">
		<Avatar name={x.name} foto={x.foto} groesse={112} />
		<div class="stapel eng">
			<h1>{x.name}</h1>
			{#if x.position}<p class="position">{x.position}</p>{/if}
			<p class="hinweis">{x.tenantName}</p>
			{#if x.self}
				<a class="knopf zweit klein" href={resolve('/(app)/konto')}>Profil bearbeiten</a>
			{/if}
		</div>
	</div>

	<section class="karte" aria-labelledby="h-kontakt">
		<h2 id="h-kontakt">Kontakt</h2>
		<dl class="kontakt">
			<div>
				<dt>E-Mail</dt>
				<dd><a href="mailto:{x.email}">{x.email}</a></dd>
			</div>
			{#if x.phone}
				<div>
					<dt>Telefon</dt>
					<dd><a href="tel:{x.phone}">{x.phone}</a></dd>
				</div>
			{/if}
			{#if x.mobile}
				<div>
					<dt>Mobil</dt>
					<dd><a href="tel:{x.mobile}">{x.mobile}</a></dd>
				</div>
			{/if}
			{#if x.room}
				<div>
					<dt>Raum</dt>
					<dd>{x.room}</dd>
				</div>
			{/if}
			{#if x.standorte.length}
				<div>
					<dt>{x.standorte.length === 1 ? 'Standort' : 'Standorte'}</dt>
					<dd>{x.standorte.join(', ')}</dd>
				</div>
			{/if}
		</dl>
	</section>

	{#if abteilungen.length}
		<section class="karte" aria-labelledby="h-abt">
			<h2 id="h-abt">Abteilungen</h2>
			<ul class="liste">
				{#each abteilungen as e (e.id)}
					<li>
						<a href={resolve('/(app)/abteilungen/[slug]', { slug: e.slug })}>{e.name}</a>
						<span class="hinweis">
							{[e.rolle, e.type === 'abteilung' ? null : e.label].filter(Boolean).join(' · ')}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if x.zustaendigkeiten.length}
		<section class="karte" aria-labelledby="h-zust">
			<h2 id="h-zust">Hilft bei</h2>
			<ul class="liste">
				{#each x.zustaendigkeiten as z (z.id)}
					<li>
						<span><strong>{z.topic}</strong>{z.vertretung ? ' (Vertretung)' : ''}</span>
						<a href={resolve('/(app)/abteilungen/[slug]', { slug: z.slug })}>{z.unitName}</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if hubs.length}
		<section class="karte" aria-labelledby="h-hubs">
			<h2 id="h-hubs">Hubs</h2>
			<ul class="liste">
				{#each hubs as e (e.id)}
					<li><a href={resolve('/(app)/hubs/[slug]', { slug: e.slug })}>{e.name}</a></li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.seite {
		max-width: 48rem;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: center;
	}
	.eng {
		gap: 4px;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
		margin-bottom: 8px;
	}
	.position {
		margin: 0;
		font-weight: 600;
	}
	.hinweis {
		margin: 0;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
		justify-self: start;
		align-self: flex-start;
		margin-top: 6px;
	}
	.kontakt {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
		gap: 12px 24px;
		margin: 0;
	}
	dt {
		font-size: 13px;
		color: var(--mu);
	}
	dd {
		margin: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.liste li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
	}
	.liste li:first-child {
		border-top: 0;
	}
</style>
