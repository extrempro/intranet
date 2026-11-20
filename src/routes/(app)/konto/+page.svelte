<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Konto · Intranet</title></svelte:head>

<div class="stapel">
	<h1>Konto und Einstellungen</h1>
	<h2>Persönlich</h2>
	<ul class="kacheln">
		<li>
			<a class="karte kachel" href={resolve('/(app)/konto/standorte')}>
				<strong>Meine Standorte</strong><span class="hinweis">Kantine für den Speiseplan</span>
			</a>
		</li>
	</ul>
	<h2>Benachrichtigungen</h2>
	<ul class="kacheln">
		<li>
			<a class="karte kachel" href={resolve('/(app)/konto/benachrichtigungen')}>
				<strong>Benachrichtigungen</strong><span class="hinweis">Glocke und E-Mail je Thema</span>
			</a>
		</li>
	</ul>
	<h2>Weitere Einstellungen</h2>
	<ul class="kacheln">
		<li>
			<a class="karte kachel" href={resolve('/(app)/konto/darstellung')}>
				<strong>Darstellung</strong><span class="hinweis">Hell, dunkel oder automatisch</span>
			</a>
		</li>
		<li>
			<a class="karte kachel" href={resolve('/(app)/konto/sicherheit')}>
				<strong>Sicherheit</strong><span class="hinweis">Angemeldete Geräte, zweiter Faktor</span>
			</a>
		</li>
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
	.kachel:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.1);
	}
</style>
