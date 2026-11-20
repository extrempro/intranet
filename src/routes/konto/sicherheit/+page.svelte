<script lang="ts">
	let { data, form } = $props();
	const datum = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });
	const zeit = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

	/** Grobe, verständliche Gerätebeschreibung aus dem User-Agent. */
	function geraet(ua: string | null): string {
		if (!ua) return 'Unbekanntes Gerät';
		const os = /iPhone|iPad/.test(ua)
			? 'iPhone/iPad'
			: /Android/.test(ua)
				? 'Android'
				: /Windows/.test(ua)
					? 'Windows'
					: /Mac OS X/.test(ua)
						? 'Mac'
						: /Linux/.test(ua)
							? 'Linux'
							: 'Gerät';
		const browser = /Edg\//.test(ua)
			? 'Edge'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: 'Browser';
		return `${browser} auf ${os}`;
	}
</script>

<svelte:head>
	<title>Sicherheit · Konto · Intranet</title>
</svelte:head>

<section class="karte" aria-labelledby="titel">
	<h1 id="titel">Sicherheit</h1>

	<h2>Angemeldete Geräte</h2>
	{#if form?.sitzungFehler}<p class="meldung fehler" role="alert">{form.sitzungFehler}</p>{/if}
	{#if form?.sitzungBeendet}<p class="meldung" role="status">Erledigt.</p>{/if}
	<ul class="sitzungen">
		{#each data.sitzungen as s (s.id)}
			<li>
				<div>
					<strong>{geraet(s.geraet)}</strong>{#if s.aktuell}
						· dieses Gerät{/if}<br />
					<span class="klein">
						Angemeldet {zeit.format(s.seit)} ({s.art === 'entra' ? 'Microsoft' : 'lokal'}), zuletzt
						aktiv
						{zeit.format(s.zuletzt)}{#if s.netz}
							· Netz {s.netz}{/if}
					</span>
				</div>
				{#if !s.aktuell}
					<form method="POST" action="?/sitzungBeenden">
						<input type="hidden" name="id" value={s.id} />
						<button class="link" type="submit">Beenden</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
	{#if data.sitzungen.length > 1}
		<form method="POST" action="?/andereBeenden">
			<button class="knopf" type="submit">Alle anderen Geräte abmelden</button>
		</form>
	{/if}

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
	.sitzungen {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 0.75rem;
	}
	.sitzungen li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		border-bottom: 1px solid #ccc;
		padding-bottom: 0.5rem;
	}
	.klein {
		font-size: 0.9rem;
	}
	.link {
		min-height: 44px;
		background: none;
		border: 0;
		font: inherit;
		color: #1f4f8f;
		text-decoration: underline;
		cursor: pointer;
	}
	.meldung {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #eef3fb;
		color: #10233f;
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
