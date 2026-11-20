<script lang="ts">
	let { data, form } = $props();
	const datum = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });
</script>

<svelte:head>
	<title>Sicherheit · Konto · Intranet</title>
</svelte:head>

<section class="karte" aria-labelledby="titel">
	<h1 id="titel">Sicherheit</h1>

	{#if !data.lokal}
		<p>
			Du meldest dich mit deinem Microsoft-Konto an. Passwort und zweiten Faktor verwaltest du dort.
		</p>
	{:else}
		<h2>Zweiter Faktor</h2>
		<ul>
			<li>Authenticator-App: {data.totp ? 'eingerichtet' : 'nicht eingerichtet'}</li>
			<li>
				Passkeys:
				{#if data.passkeys.length === 0}keine{:else}
					<ul>
						{#each data.passkeys as p (p.createdAt)}
							<li>
								{p.name} – angelegt {datum.format(p.createdAt)}{#if p.lastUsedAt}, zuletzt genutzt
									{datum.format(p.lastUsedAt)}{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		</ul>

		<h2>Wiederherstellungscodes</h2>
		{#if form?.codes}
			<p>
				<strong>Deine neuen Codes – du siehst sie nur jetzt.</strong> Alle alten Codes gelten nicht mehr.
			</p>
			<ol class="codes">
				{#each form.codes as code (code)}<li><code>{code}</code></li>{/each}
			</ol>
		{:else}
			<p>Noch {data.restCodes} von 10 Codes übrig.</p>
			<form method="POST" action="?/neueCodes" class="felder">
				{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
				<label>
					Zur Bestätigung dein Passwort
					<input name="passwort" type="password" autocomplete="current-password" required />
				</label>
				<button class="knopf" type="submit">Neue Codes erzeugen</button>
			</form>
		{/if}
	{/if}
</section>

<style>
	.karte {
		max-width: 36rem;
		margin: 3rem auto;
		padding: 0 1rem;
	}
	.felder {
		display: grid;
		gap: 0.75rem;
		max-width: 24rem;
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
	.codes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem 1.5rem;
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
	:focus-visible {
		outline: 3px solid #1f4f8f;
		outline-offset: 2px;
	}
	.meldung.fehler {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #fdecec;
		color: #6b1010;
	}
</style>
