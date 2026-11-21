<script lang="ts">
	import { hierAnwenden, hierBleiben } from '#lib/formular.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import FotoZuschnitt from '#lib/components/FotoZuschnitt.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Info from '#lib/components/Info.svelte';
	import StandortWahl from '#lib/components/StandortWahl.svelte';
	import KontoBenachrichtigungen from '#lib/components/konto/KontoBenachrichtigungen.svelte';
	import KontoKontakt from '#lib/components/konto/KontoKontakt.svelte';

	let { data, form } = $props();
	const pr = $derived(data.profil);
	/** Rückmeldung nur im Abschnitt, aus dem gespeichert wurde. */
	const fuer = (b: string) =>
		form && (form as { bereich?: string }).bereich === b ? (form as Record<string, unknown>) : null;
	let fotoOffen = $state(false);
	let theme = $derived<string>(data.theme);
	let neuerungen = $derived<boolean>(data.neuerungen);
	const DARSTELLUNG = [
		{ wert: 'auto', text: 'Automatisch' },
		{ wert: 'hell', text: 'Hell' },
		{ wert: 'dunkel', text: 'Dunkel' }
	];
	const PFEIL = 'M9 6l6 6l-6 6';
	const BUCH =
		'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13';
</script>

<svelte:head><title>Konto · Intranet</title></svelte:head>

<div class="konto">
	<h1>Konto</h1>

	<h2 class="abschnitt">Persönlich</h2>
	{#if fuer('profil')?.fehler}<p class="meldung fehler" role="alert">
			{fuer('profil')?.fehler}
		</p>{/if}
	{#if fuer('profil')?.ok}<p class="meldung" role="status">{fuer('profil')?.ok}</p>{/if}
	<div class="zwei">
		<section class="karte block" aria-labelledby="h-profil">
			<h3 id="h-profil">Profil</h3>
			<div class="person">
				<Avatar name={pr.name} foto={pr.foto} groesse={44} />
				<span class="personentext">
					<strong>{pr.name}</strong>
					<span class="unter">{[...data.einheiten, data.anmeldung].join(' · ')}</span>
				</span>
			</div>
			<div class="zeile">
				<span class="zeilentext">
					<strong class="mit-info">
						Profilfoto <span class="optional">(freiwillig)</span>
						<Info
							thema="Profilfoto"
							text="Das Foto wird verschlüsselt gespeichert, ohne Metadaten wie Ort oder Kamera. Sichtbar für alle, die dich im Intranet sehen."
						/>
					</strong>
					<span class="unter">
						Wird verschlüsselt nur im Intranet gespeichert und nicht weitergegeben.
					</span>
				</span>
				<span class="zeilenknoepfe">
					<button
						type="button"
						class="knopf zweit klein"
						aria-expanded={fotoOffen}
						onclick={() => (fotoOffen = !fotoOffen)}
					>
						{pr.foto ? 'Foto ändern' : 'Foto hochladen'}
					</button>
					{#if pr.foto}
						<form method="POST" action="/konto/profil?/fotoLoeschen" use:enhance={hierBleiben}>
							<button class="linkknopf" type="submit">Löschen</button>
						</form>
					{/if}
				</span>
			</div>
			{#if fotoOffen}<FotoZuschnitt aktion="/konto/profil?/foto" />{/if}
			<div class="zeile">
				<span class="zeilentext">
					<strong>Mandant</strong>
					<span class="unter">Legt die Verwaltung fest.</span>
				</span>
				<span class="schild">{data.ich.mandant}</span>
			</div>
			<a class="aktionslink" href={resolve('/(app)/personen/[id]', { id: pr.id })}>
				So sehen dich andere
			</a>
		</section>

		<section class="karte block" aria-labelledby="h-standorte">
			<h3 id="h-standorte" class="mit-info">
				Meine Standorte
				<Info
					thema="Meine Standorte"
					text="Wähle alle Standorte, an denen du arbeitest. Du siehst dann Speiseplan und Öffnungszeiten dieser Kantinen."
				/>
			</h3>
			{#if fuer('standorte')?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
			{#if data.standorte.alle.length === 0}
				<p class="hinweis">Es ist noch kein Kantinen-Standort eingerichtet.</p>
			{:else}
				<StandortWahl
					alle={data.standorte.alle}
					meine={data.standorte.meine}
					action="/konto/standorte?/standorte"
				/>
			{/if}
		</section>
	</div>

	<section class="karte block" aria-labelledby="h-kontakt">
		<h3 id="h-kontakt" class="mit-info">
			Kontaktdaten
			<Info
				thema="Kontaktdaten"
				text="Diese Angaben pflegst du selbst; aus Entra wird nichts übernommen."
			/>
		</h3>
		<p class="unter">
			Alle Angaben sind freiwillig. Sie erscheinen bei deinem Namen in der Personensuche, im Team
			deiner Abteilung und in Hubs.
		</p>
		<KontoKontakt profil={pr} form={fuer('profil')} />
	</section>

	<h2 class="abschnitt">Benachrichtigungen</h2>
	<KontoBenachrichtigungen daten={data.benachrichtigungen} form={fuer('benachrichtigungen')} />
	<a class="karte zeilenlink" href={resolve('/(app)/konto/hubs')}>
		<span class="zeilentext">
			<strong>Meine Hubs</strong>
			<span class="unter">
				{data.hubs.anzahl === 1 ? '1 abonniert' : `${data.hubs.anzahl} abonniert`}{data.hubs.eigene
					? ` · ${data.hubs.eigene} mit eigener Einstellung`
					: ''}
			</span>
		</span>
		<Icon d={PFEIL} size={18} stroke={2} />
	</a>

	<h2 class="abschnitt">Weitere Einstellungen</h2>
	<div class="drei">
		<section class="karte block" aria-labelledby="h-darstellung">
			<h3 id="h-darstellung">Darstellung</h3>
			<form
				method="POST"
				action="/konto/darstellung?/setzen"
				class="pillen"
				use:enhance={({ formData }) => {
					const wert = String(formData.get('wert'));
					theme = wert;
					document.documentElement.dataset.theme = wert;
					return async ({ result }) => hierAnwenden(result);
				}}
			>
				{#each DARSTELLUNG as o (o.wert)}
					<button
						class="pille"
						type="submit"
						name="wert"
						value={o.wert}
						aria-pressed={theme === o.wert}
					>
						{o.text}
					</button>
				{/each}
			</form>
			<p class="unter">Gilt auf allen deinen Geräten. „Automatisch“ folgt deinem Gerät.</p>
			<h4 id="h-neuerungen">Neuerungen nach einem Update</h4>
			<form
				method="POST"
				action="?/neuerungen"
				class="pillen"
				aria-labelledby="h-neuerungen"
				use:enhance={({ formData }) => {
					neuerungen = formData.get('wert') === 'an';
					return async ({ result }) => hierAnwenden(result);
				}}
			>
				<button class="pille" type="submit" name="wert" value="an" aria-pressed={neuerungen}>
					Anzeigen
				</button>
				<button class="pille" type="submit" name="wert" value="aus" aria-pressed={!neuerungen}>
					Nicht anzeigen
				</button>
			</form>
			<p class="unter">Nach einem Update einmal kurz zeigen, was neu ist.</p>
		</section>

		<section class="karte block" aria-labelledby="h-sicherheit">
			<h3 id="h-sicherheit">Sicherheit</h3>
			<a class="handbuch" href={resolve('/(app)/handbuch/[slug]', { slug: 'erste-schritte' })}>
				<Icon d={BUCH} size={14} stroke={2} />Handbuch
			</a>
			<p class="unter">
				Angemeldete Geräte, zweiter Faktor und – beim lokalen Konto – dein Passwort.
			</p>
			<a class="knopf zweit" href={resolve('/(app)/konto/sicherheit')}>Sicherheit öffnen</a>
		</section>

		<section class="karte block" aria-labelledby="h-hilfe">
			<h3 id="h-hilfe">Hilfe und Verwaltung</h3>
			<a class="knopf zweit" href={resolve('/(app)/handbuch')}>Handbuch</a>
			<a class="knopf zweit" href="{resolve('/(app)')}?fuehrung=1">Führung erneut starten</a>
			<form method="POST" action="?/einfuehrungen" use:enhance>
				<button class="knopf zweit breit" type="submit">Einführungen wieder anbieten</button>
			</form>
			{#if fuer('hilfe')?.zurueckgesetzt}<p class="meldung" role="status">
					Erledigt. Die Einführungen erscheinen wieder.
				</p>{/if}
			<a class="knopf zweit" href={resolve('/(app)/rueckmeldung')}>Meine Meldungen</a>
			{#if data.darfVerwaltung}
				<a class="knopf zweit" href={resolve('/(app)/verwaltung')}>Verwaltung</a>
			{/if}
		</section>
	</div>

	<!-- Handy: kein Hauptmenü an der Seite, daher hier -->
	<p class="infolinks">
		<a href={resolve('/(app)/neu-im-intranet')}>Neu im Intranet</a>
		{#if data.rechtliches.datenschutz}
			<span aria-hidden="true">·</span>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- externer Link -->
			<a href={data.rechtliches.datenschutz} rel="noopener">Datenschutz</a>
		{/if}
		{#if data.rechtliches.impressum}
			<span aria-hidden="true">·</span>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- externer Link -->
			<a href={data.rechtliches.impressum} rel="noopener">Impressum</a>
		{/if}
		<span aria-hidden="true">·</span>
		<span>Version {data.version}</span>
	</p>
</div>

<style>
	.infolinks {
		display: none;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 8px;
		margin: 16px 0 0;
		font-size: 13px;
		color: var(--mu);
	}
	.infolinks a {
		display: inline-flex;
		align-items: center;
		min-height: 24px;
		color: var(--mu);
	}
	@media (max-width: 599px) {
		.infolinks {
			display: flex;
		}
	}
	.konto {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	h1 {
		margin: 0;
	}
	.abschnitt {
		margin: 8px 0 0;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	h3 {
		margin: 0;
		font-size: 18px;
	}
	h4 {
		margin: 8px 0 0;
		font-size: 15px;
	}
	.mit-info {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.zwei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
		gap: 16px;
		align-items: start;
	}
	.drei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
		gap: 16px;
		align-items: start;
	}
	.unter {
		margin: 0;
		font-size: 13px;
		color: var(--mu);
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.person {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.personentext,
	.zeilentext {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--bd);
	}
	.zeilentext strong {
		font-size: 14px;
	}
	.zeilenknoepfe {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 14px;
		font-size: 14px;
	}
	.zeilenlink {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		color: var(--tx);
		text-decoration: none;
	}
	.zeilenlink :global(svg) {
		color: var(--mu);
	}
	.zeilenlink:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.handbuch {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.breit {
		width: 100%;
	}
</style>
