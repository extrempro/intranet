<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import RolleWaehlen from '#lib/components/RolleWaehlen.svelte';
	import { formatWhen } from '#lib/news.ts';

	let { data, form } = $props();
	const x = $derived(data.person);
	let sperrenFragen = $state(false);
</script>

<svelte:head><title>{x.name} · Benutzer · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung/benutzer')}>← Benutzer und Rollen</a>
	<h1>{x.name}</h1>
	<p class="hinweis">
		{x.email} · {x.tenantName} · {x.authSource === 'entra'
			? 'Anmeldung mit Microsoft'
			: 'Lokales Konto'}
		{#if x.lastLoginAt}
			· zuletzt angemeldet {formatWhen(x.lastLoginAt)}{/if}
	</p>
	{#if x.status === 'disabled'}<p class="meldung fehler">Dieses Konto ist gesperrt.</p>{/if}
	{#if x.einladungOffen && x.status !== 'disabled'}<p class="meldung">
			Die Einladung ist noch nicht angenommen.
		</p>{/if}

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}

	<section class="karte stapel" aria-labelledby="h-rollen">
		<h2 id="h-rollen">Rollen</h2>
		{#if x.roles.length === 0}
			<p class="hinweis">Keine Rollen. Lesen dürfen alle angemeldeten Personen.</p>
		{:else}
			<ul class="liste">
				{#each x.roles as r (r.id)}
					<li>
						<span><strong>{r.roleLabel}</strong> · {r.scopeText}</span>
						{#if r.source === 'entra'}
							<span class="schild rand">aus Entra-Gruppe</span>
						{:else if r.mayRevoke}
							<form method="POST" action="?/entziehen" use:enhance>
								<input type="hidden" name="zuordnung" value={r.id} />
								<button class="linkknopf" type="submit" aria-label="{r.roleLabel} entziehen">
									Entziehen
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if x.roleOptions.length}
			<h3>Rolle vergeben</h3>
			<form method="POST" action="?/vergeben" class="felder" use:enhance>
				<RolleWaehlen
					rollen={x.roleOptions}
					mandanten={x.tenantOptions}
					einheiten={x.unitOptions}
				/>
				<button class="knopf" type="submit">Vergeben</button>
			</form>
		{/if}
		<p class="hinweis">
			Abteilungsverwaltung, Hub-Team und Schreibrechte vergibst du einfacher im Team der Einheit
			unter Abteilungen und Hubs. Rollen aus Entra-Gruppen ändern sich bei der nächsten Anmeldung.
		</p>
	</section>

	{#if !x.ich}
		<section class="karte stapel" aria-labelledby="h-konto">
			<h2 id="h-konto">Konto</h2>
			{#if x.status === 'disabled'}
				<form method="POST" action="?/freigeben" use:enhance>
					<button class="knopf zweit" type="submit">Wieder freigeben</button>
				</form>
			{:else if sperrenFragen}
				<form
					method="POST"
					action="?/sperren"
					class="frage"
					use:enhance={() =>
						async ({ update }) => {
							sperrenFragen = false;
							await update();
						}}
				>
					<span>Konto sperren? Alle Sitzungen enden sofort.</span>
					<button class="knopf rot" type="submit">Ja, sperren</button>
					<button class="knopf zweit" type="button" onclick={() => (sperrenFragen = false)}>
						Abbrechen
					</button>
				</form>
			{:else}
				<button class="knopf zweit" type="button" onclick={() => (sperrenFragen = true)}>
					Konto sperren
				</button>
				{#if x.authSource === 'entra'}
					<p class="hinweis">
						Gesperrt bleibt das Konto hier gesperrt, auch wenn es in Entra aktiv ist.
					</p>
				{/if}
			{/if}
		</section>
	{/if}
</div>

<style>
	.seite {
		max-width: 46rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h2,
	h3 {
		margin: 0;
	}
	h3 {
		font-size: 1rem;
		margin-top: 8px;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		border-bottom: 1px solid var(--bd);
	}
	.frage {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.rot {
		background: #b42318;
		border-color: #b42318;
	}
	.knopf {
		justify-self: start;
	}
</style>
