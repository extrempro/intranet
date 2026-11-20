<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>Verwaltung · Intranet</title></svelte:head>

<div class="stapel">
	<h1>Verwaltung</h1>
	<h2>Organisation</h2>
	<ul class="kacheln">
		<li>
			<a class="karte kachel" href={resolve('/(app)/verwaltung/mandanten')}>
				<strong>Mandanten</strong><span class="hinweis">Domains, Farben, Mandanten-Admins</span>
			</a>
		</li>
		<li>
			<a class="karte kachel" href={resolve('/(app)/verwaltung/abteilungen')}>
				<strong>Abteilungen und Hubs</strong><span class="hinweis">
					Einheiten, Team, Schreibrechte
				</span>
			</a>
		</li>
		<li>
			<a class="karte kachel" href={resolve('/(app)/verwaltung/standorte')}>
				<strong>Standorte</strong><span class="hinweis">Kantinen und Betreiber-Konten</span>
			</a>
		</li>
	</ul>
	<h2>Zugänge</h2>
	<ul class="kacheln">
		<li>
			<a class="karte kachel" href={resolve('/(app)/verwaltung/benutzer')}>
				<strong>Benutzer und Rollen</strong><span class="hinweis">
					Rollen vergeben, Konten sperren
				</span>
			</a>
		</li>
		<li>
			<a class="karte kachel" href={resolve('/(app)/verwaltung/einladen')}>
				<strong>Lokales Konto einladen</strong><span class="hinweis">
					Für Personen ohne Microsoft-Konto
				</span>
			</a>
		</li>
		{#if data.systemAdmin}
			<li>
				<a class="karte kachel" href={resolve('/(app)/verwaltung/anmeldung')}>
					<strong>Anmeldung</strong><span class="hinweis">Abmelden nach Inaktivität</span>
				</a>
			</li>
			<li>
				<a class="karte kachel" href={resolve('/(app)/verwaltung/kulissen')}>
					<strong>Hinter den Kulissen</strong><span class="hinweis">Hinweis „So geht’s“</span>
				</a>
			</li>
			<li>
				<a class="karte kachel" href={resolve('/(app)/verwaltung/schwarzes-brett')}>
					<strong>Schwarzes Brett</strong><span class="hinweis">Kategorien</span>
				</a>
			</li>
			<li>
				<a class="karte kachel" href={resolve('/(app)/verwaltung/entra-gruppen')}>
					<strong>Rollen aus Entra-Gruppen</strong><span class="hinweis">
						Gruppe → Rolle zuordnen
					</span>
				</a>
			</li>
		{/if}
	</ul>
</div>

<style>
	.kacheln {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}
	.kachel {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 88px;
		color: var(--tx);
		text-decoration: none;
	}
</style>
