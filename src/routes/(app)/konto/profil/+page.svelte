<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import FotoZuschnitt from '#lib/components/FotoZuschnitt.svelte';
	import KontoKontakt from '#lib/components/konto/KontoKontakt.svelte';

	let { data, form } = $props();
	const pr = $derived(data.profil);
</script>

<svelte:head><title>Mein Profil · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<div>
		<h1>Mein Profil</h1>
		<p class="hinweis">
			Diese Angaben pflegst du selbst; aus Entra wird nichts übernommen.
			<a href={resolve('/(app)/personen/[id]', { id: pr.id })}>So sehen dich andere</a>
		</p>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	<section class="karte stapel" aria-labelledby="h-foto">
		<h2 id="h-foto">Profilfoto</h2>
		<div class="fotozeile">
			<Avatar name={pr.name} foto={pr.foto} groesse={96} />
			<p class="hinweis">
				Freiwillig. Das Foto wird verschlüsselt gespeichert, ohne Metadaten wie Ort oder Kamera.
				Sichtbar für alle, die dich im Intranet sehen.
			</p>
		</div>
		<FotoZuschnitt />
		{#if pr.foto}
			<form method="POST" action="?/fotoLoeschen" use:enhance>
				<button class="linkknopf" type="submit">Foto löschen</button>
			</form>
		{/if}
	</section>

	<section class="karte stapel" aria-labelledby="h-kontakt">
		<h2 id="h-kontakt">Kontaktdaten</h2>
		<p class="hinweis">{pr.name} · {pr.email}</p>
		<KontoKontakt profil={pr} {form} />
		<p class="hinweis">
			Deinen Standort für den Speiseplan wählst du unter
			<a href={resolve('/(app)/konto/standorte')}>Meine Standorte</a>.
		</p>
	</section>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.fotozeile {
		display: flex;
		gap: 16px;
		align-items: center;
	}
	.fotozeile .hinweis {
		margin: 0;
	}
</style>
