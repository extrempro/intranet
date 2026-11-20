<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Passwort vergessen · Intranet</title>
</svelte:head>

<div class="stapel">
	<h1>Passwort vergessen</h1>
	{#if !data.verfuegbar}
		<p>
			Zurücksetzen per E-Mail ist noch nicht eingerichtet. Wende dich bitte an die IT, damit sie dir
			eine neue Einladung schickt.
		</p>
	{:else if form?.gesendet}
		<p class="meldung" role="status">
			Wenn es zu dieser Adresse ein lokales Konto gibt, bekommst du gleich eine E-Mail mit einem
			Link. Schau auch im Spam-Ordner nach.
		</p>
		<p class="hinweis">
			Mit einem Microsoft-Konto änderst du dein Passwort bei Microsoft, nicht hier.
		</p>
	{:else}
		<p>
			Gib die E-Mail-Adresse deines lokalen Kontos ein. Wir schicken dir einen Link, mit dem du ein
			neues Passwort festlegst. Deinen zweiten Faktor brauchst du danach weiterhin.
		</p>
		<form method="POST" class="felder">
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			<label class="feld">
				<span>E-Mail-Adresse</span>
				<input name="email" type="email" autocomplete="username" maxlength="320" required />
			</label>
			<button class="knopf breit" type="submit">Link schicken</button>
		</form>
	{/if}
	<a class="zurueck" href={resolve('/(auth)/anmelden')}>← Zur Anmeldung</a>
</div>

<style>
	h1 {
		font-size: 24px;
		margin: 0;
	}
	.breit {
		width: 100%;
		min-height: 48px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
</style>
