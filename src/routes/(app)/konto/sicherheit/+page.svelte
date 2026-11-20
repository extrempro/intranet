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

<div class="stapel seite">
	<h1>Sicherheit</h1>

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
						<button class="linkknopf" type="submit">Beenden</button>
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
				<label class="feld">
					<span>Zur Bestätigung dein Passwort</span>
					<input name="passwort" type="password" autocomplete="current-password" required />
				</label>
				<button class="knopf" type="submit">Neue Codes erzeugen</button>
			</form>
		{/if}
	{/if}
</div>

<style>
	.seite {
		max-width: 40rem;
	}
	.sitzungen {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}
	.sitzungen li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		border-bottom: 1px solid var(--bd);
		padding-bottom: 0.5rem;
	}
	.klein {
		font-size: 0.9rem;
		color: var(--mu);
	}
</style>
