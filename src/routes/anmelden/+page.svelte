<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Anmelden · Intranet</title>
</svelte:head>

<section class="karte" aria-labelledby="titel">
	<h1 id="titel">Anmelden</h1>

	{#if data.fehler}
		<p class="meldung fehler" role="alert">{data.fehler}</p>
	{:else if data.abgemeldet}
		<p class="meldung" role="status">Du bist abgemeldet.</p>
	{/if}

	{#if data.entraAktiv}
		<form method="GET" action="/anmelden/entra" data-sveltekit-reload>
			{#if data.ziel !== '/'}<input type="hidden" name="ziel" value={data.ziel} />{/if}
			<button class="knopf" type="submit">Mit Microsoft anmelden</button>
		</form>
		<p class="hinweis">Mit deinem Firmenkonto. Die Zwei-Faktor-Prüfung erledigt Microsoft.</p>
	{/if}

	<details open={!data.entraAktiv || !!form?.lokalFehler}>
		<summary>Ohne Microsoft-Konto anmelden</summary>
		<form method="POST" action="?/lokal" class="felder">
			<input type="hidden" name="ziel" value={data.ziel} />
			{#if form?.lokalFehler}
				<p class="meldung fehler" role="alert">{form.lokalFehler}</p>
			{/if}
			<label>
				E-Mail-Adresse
				<input
					name="email"
					type="email"
					autocomplete="username"
					required
					value={form?.email ?? ''}
				/>
			</label>
			<label>
				Passwort
				<input name="passwort" type="password" autocomplete="current-password" required />
			</label>
			<button class="knopf zweit" type="submit">Weiter</button>
		</form>
	</details>
</section>

<style>
	.karte {
		max-width: 26rem;
		margin: 4rem auto;
		padding: 0 1rem;
	}
	.felder {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.75rem;
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
	summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		cursor: pointer;
	}
	.knopf {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 999px;
		background: var(--akzent, #1f4f8f);
		color: #fff;
		font: inherit;
		font-weight: 600;
		border: 0;
		cursor: pointer;
	}
	.knopf.zweit {
		justify-self: start;
	}
	.knopf:focus-visible,
	input:focus-visible,
	summary:focus-visible {
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
