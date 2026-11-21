<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	type Mandant = {
		name: string;
		kurz: string;
		domains: string;
		akzent: string;
		akzentDunkel: string;
	};
	type Person = { name: string; email: string };
	const f = $derived(form as { eingabe?: Mandant; person?: Person } | null);
	const v = $derived<Mandant | null>(f?.eingabe ?? (data.gueltig ? data.vorbelegung : null));
	const person = $derived<Person | null>(f?.person ?? null);
</script>

<svelte:head>
	<title>Einrichtung · Intranet</title>
</svelte:head>

<div class="stapel">
	{#if !data.gueltig}
		<h1>Link gilt nicht</h1>
		<p>
			Dieser Einrichtungslink ist abgelaufen, wurde schon benutzt oder die Einrichtung ist
			abgeschlossen. Einen neuen Link für die Ersteinrichtung erzeugt ein Neustart der Anwendung,
			einen Notfallzugang der Befehl <code>node scripts/notfall-admin.mjs</code> im Container (siehe Anleitung
			zur Inbetriebnahme).
		</p>
	{:else if data.schritt === 'mandant'}
		<p class="hinweis">Schritt 1 von 3</p>
		<h1>Hauptmandant</h1>
		<p>
			Das Haus, zu dem die zentralen Abteilungen gehören. Weitere Mandanten, Logo, Datenschutz und
			Impressum legst du danach in der Verwaltung an.
		</p>
		<form method="POST" action="?/mandant" class="felder" use:enhance>
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			<label class="feld">
				<span>Name</span>
				<input name="name" required minlength="2" maxlength="120" value={v?.name ?? ''} />
			</label>
			<label class="feld">
				<span>Kürzel</span>
				<input name="kurz" required maxlength="10" value={v?.kurz ?? ''} />
			</label>
			<label class="feld">
				<span>E-Mail-Domains</span>
				<input
					name="domains"
					required
					placeholder="staatsoper-hamburg.de"
					value={v?.domains ?? ''}
					aria-describedby="domains-hinweis"
				/>
				<small id="domains-hinweis" class="hinweis">
					Mehrere mit Komma trennen. Über die Domain der E-Mail-Adresse ordnet das Intranet Personen
					ihrem Mandanten zu.
				</small>
			</label>
			<div class="farben">
				<label class="feld">
					<span>Akzentfarbe hell</span>
					<input type="color" name="akzent" value={v?.akzent ?? '#0F6E56'} />
				</label>
				<label class="feld">
					<span>Akzentfarbe dunkel</span>
					<input type="color" name="akzentDunkel" value={v?.akzentDunkel ?? '#5DCAA5'} />
				</label>
			</div>
			<button class="knopf" type="submit">Weiter</button>
		</form>
	{:else}
		{#if data.art === 'erst'}
			<p class="hinweis">Schritt 2 von 3</p>
			<h1>Erster Admin</h1>
			<p>
				Lege dein lokales Konto mit der Rolle System-Admin an. Es ist auch dein Notfallzugang, falls
				die Anmeldung mit Microsoft einmal nicht geht. Danach legst du Passwort und zweiten Faktor
				fest.
			</p>
		{:else}
			<h1>Notfallzugang anlegen</h1>
			<p>
				Lege ein weiteres lokales Konto mit der Rolle System-Admin an. Danach legst du Passwort und
				zweiten Faktor fest.
			</p>
		{/if}
		<form method="POST" action="?/admin" class="felder">
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			<label class="feld">
				<span>Name</span>
				<input
					name="anzeigename"
					required
					minlength="2"
					maxlength="120"
					autocomplete="name"
					value={person?.name ?? ''}
				/>
			</label>
			<label class="feld">
				<span>E-Mail-Adresse</span>
				<input
					name="email"
					type="email"
					required
					maxlength="320"
					autocomplete="email"
					value={person?.email ?? ''}
				/>
			</label>
			<button class="knopf" type="submit">Weiter</button>
		</form>
	{/if}
</div>

<style>
	.farben {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.farben input[type='color'] {
		width: 100%;
		min-height: 44px;
		padding: 4px;
	}
</style>
