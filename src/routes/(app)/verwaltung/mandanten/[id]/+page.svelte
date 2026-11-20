<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MandantFelder from '#lib/components/MandantFelder.svelte';

	let { data, form } = $props();
	const m = $derived(data.mandant);
	const behalten =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<svelte:head><title>{m.name} · Mandanten · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung/mandanten')}>← Mandanten</a>
	<h1>{m.name}</h1>
	{#if m.isMain}<p class="hinweis">
			Hauptmandant: Zentrale Einheiten und Stabsstellen gehören zu ihm.
		</p>{/if}

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}

	<section class="karte stapel" aria-labelledby="h-angaben">
		<h2 id="h-angaben">Angaben und Farben</h2>
		<form method="POST" action="?/speichern" class="felder" use:enhance={behalten}>
			{#key m}<MandantFelder werte={m} />{/key}
			<button class="knopf" type="submit">Speichern</button>
		</form>
	</section>

	<section class="karte stapel" aria-labelledby="h-domains">
		<h2 id="h-domains">E-Mail-Domains</h2>
		<p class="hinweis">
			Wer sich mit einer dieser Domains anmeldet, gehört zu {m.name}. Bei Microsoft zählt das Feld
			„E-Mail“ im Konto, ist es leer, der Anmeldename (UPN).
		</p>
		{#if m.domains.length === 0}
			<p class="meldung fehler">
				Noch keine Domain – niemand kann sich für diesen Mandanten anmelden.
			</p>
		{:else}
			<ul class="liste">
				{#each m.domains as d (d)}
					<li>
						<span>{d}</span>
						{#if data.systemAdmin}
							<form method="POST" action="?/domainEntfernen" use:enhance>
								<input type="hidden" name="domain" value={d} />
								<button class="linkknopf" type="submit" aria-label="{d} entfernen">
									Entfernen
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if data.systemAdmin}
			<form method="POST" action="?/domainHinzu" class="zeile" use:enhance>
				<label class="feld">
					<span>Domain hinzufügen</span>
					<input
						name="domain"
						required
						placeholder="z. B. staatsoper-hamburg.de"
						autocomplete="off"
					/>
				</label>
				<button class="knopf zweit" type="submit">Hinzufügen</button>
			</form>
			<p class="hinweis">
				Entfernst du eine Domain, können sich Personen damit nicht mehr anmelden. Bestehende Konten
				bleiben, bis sie gelöscht werden.
			</p>
		{/if}
	</section>

	<section class="karte stapel" aria-labelledby="h-admins">
		<h2 id="h-admins">Mandanten-Admins</h2>
		<p class="hinweis">Verwalten den eigenen Mandanten: Farben, Benutzer, Einheiten.</p>
		{#if m.admins.length === 0}
			<p class="hinweis">Noch niemand.</p>
		{:else}
			<ul class="liste">
				{#each m.admins as a (a.personId + a.source)}
					<li>
						<span><strong>{a.name}</strong><br /><span class="hinweis">{a.email}</span></span>
						{#if a.source === 'entra'}
							<span class="schild rand">aus Entra-Gruppe</span>
						{:else if data.systemAdmin}
							<form method="POST" action="?/adminEntfernen" use:enhance>
								<input type="hidden" name="person" value={a.personId} />
								<button class="linkknopf" type="submit" aria-label="{a.name} als Admin entfernen">
									Entfernen
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if data.systemAdmin}
			<form method="POST" action="?/adminHinzu" class="zeile" use:enhance>
				<label class="feld">
					<span>Mandanten-Admin hinzufügen (E-Mail-Adresse)</span>
					<input name="email" type="email" required autocomplete="off" />
				</label>
				<button class="knopf zweit" type="submit">Hinzufügen</button>
			</form>
		{/if}
	</section>
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
	h2 {
		margin: 0;
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
	.zeile {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
	}
	.zeile .feld {
		flex: 1 1 260px;
	}
	.knopf {
		justify-self: start;
	}
</style>
