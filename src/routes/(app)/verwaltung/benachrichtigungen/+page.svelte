<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	const p = $derived(data.push);
</script>

<svelte:head><title>Benachrichtigungen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung')}>← Verwaltung</a>
	<h1>Benachrichtigungen</h1>
	{#if form?.ergebnis}<p class="meldung" role="status">{form.ergebnis}</p>{/if}

	<section class="karte stapel" aria-labelledby="h-push">
		<h2 id="h-push">Web Push</h2>
		<dl class="daten">
			<div>
				<dt>Schlüssel (VAPID)</dt>
				<dd>{p.keys ? 'eingerichtet' : 'fehlen'}</dd>
			</div>
			<div>
				<dt>Kontakt für Push-Dienste</dt>
				<dd>{p.contact}</dd>
			</div>
			<div>
				<dt>Geräte mit Push</dt>
				<dd>{p.devices} ({p.persons} Personen)</dd>
			</div>
			<div>
				<dt>Wartend (Ruhezeit)</dt>
				<dd>{p.waiting}</dd>
			</div>
		</dl>
		<p class="hinweis">
			Ausgehend braucht der Server HTTPS zu den Push-Diensten: fcm.googleapis.com,
			*.push.services.mozilla.com, *.push.apple.com und *.notify.windows.com. Den Kontakt änderst du
			mit der Umgebungsvariable PUSH_CONTACT.
		</p>
		<form method="POST" action="?/test" use:enhance>
			<button class="knopf zweit" type="submit">Testnachricht an meine Geräte</button>
		</form>
	</section>

	<section class="karte stapel" aria-labelledby="h-mail">
		<h2 id="h-mail">E-Mail</h2>
		<p>
			{data.mail
				? 'Der E-Mail-Versand ist eingerichtet.'
				: 'Der E-Mail-Versand ist noch nicht eingerichtet (MAIL_SENDER und Entra-App mit Mail.Send).'}
		</p>
	</section>

	<section class="karte stapel" aria-labelledby="h-teams">
		<h2 id="h-teams">Teams</h2>
		<p class="hinweis">Folgt mit der Intranet-App im Tenant.</p>
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
	p {
		margin: 0;
	}
	.daten {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 12px 20px;
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
	.knopf {
		justify-self: start;
	}
</style>
