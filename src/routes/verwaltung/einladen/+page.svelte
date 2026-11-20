<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Lokales Konto einladen · Verwaltung · Intranet</title>
</svelte:head>

<section class="karte" aria-labelledby="titel">
	<h1 id="titel">Lokales Konto einladen</h1>
	<p>
		Für Personen ohne Microsoft-Konto. Die Person bekommt eine E-Mail mit einem Link, der 7 Tage
		gilt. Der Mandant ergibt sich aus der E-Mail-Domain.
	</p>

	{#if !data.mailBereit}
		<p class="meldung fehler" role="alert">
			Der E-Mail-Versand ist noch nicht eingerichtet (MAIL_SENDER und Entra-App mit Mail.Send).
		</p>
	{/if}
	{#if form?.gesendet}
		<p class="meldung" role="status">Die Einladung an {form.gesendet} ist unterwegs.</p>
	{/if}

	<form method="POST" class="felder">
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		<label>
			Name
			<input name="name" autocomplete="off" required maxlength="200" value={form?.name ?? ''} />
		</label>
		<label>
			E-Mail-Adresse
			<input name="email" type="email" autocomplete="off" required value={form?.email ?? ''} />
		</label>
		<button class="knopf" type="submit" disabled={!data.mailBereit}>Einladung senden</button>
	</form>
	<p class="hinweis">
		Lädst du eine schon eingeladene Person erneut ein, gilt nur noch der neue Link.
	</p>
</section>

<style>
	.karte {
		max-width: 32rem;
		margin: 3rem auto;
		padding: 0 1rem;
	}
	.felder {
		display: grid;
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
	}
	input {
		min-height: 44px;
		padding: 0 0.75rem;
		font: inherit;
		border: 1px solid #767676;
		border-radius: 0.5rem;
	}
	.knopf {
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 999px;
		background: var(--akzent, #1f4f8f);
		color: #fff;
		font: inherit;
		font-weight: 600;
		border: 0;
		cursor: pointer;
		justify-self: start;
	}
	.knopf:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	:focus-visible {
		outline: 3px solid #1f4f8f;
		outline-offset: 2px;
	}
	.meldung {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #eef3fb;
		color: #10233f;
	}
	.meldung.fehler {
		background: #fdecec;
		color: #6b1010;
	}
</style>
