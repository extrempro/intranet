<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Lokales Konto einladen · Verwaltung · Intranet</title>
</svelte:head>

<div class="stapel seite">
	<h1>Lokales Konto einladen</h1>
	<p>
		Für Personen ohne Microsoft-Konto. Die Person bekommt eine E-Mail mit einem Link, der 7 Tage
		gilt. Der Mandant ergibt sich aus der E-Mail-Domain.
	</p>

	{#if !data.mailBereit}
		<p class="meldung fehler" role="alert">
			Der E-Mail-Versand ist noch nicht eingerichtet (Verwaltung → Benachrichtigungen → E-Mail).
		</p>
	{/if}
	{#if form?.gesendet}
		<p class="meldung" role="status">Die Einladung an {form.gesendet} ist unterwegs.</p>
	{/if}

	<form method="POST" class="felder">
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		<label class="feld">
			<span>Name</span>
			<input name="name" autocomplete="off" required maxlength="200" value={form?.name ?? ''} />
		</label>
		<label class="feld">
			<span>E-Mail-Adresse</span>
			<input name="email" type="email" autocomplete="off" required value={form?.email ?? ''} />
		</label>
		<button class="knopf" type="submit" disabled={!data.mailBereit}>Einladung senden</button>
	</form>
	<p class="hinweis">
		Lädst du eine schon eingeladene Person erneut ein, gilt nur noch der neue Link.
	</p>
</div>

<style>
	.seite {
		max-width: 40rem;
	}
</style>
