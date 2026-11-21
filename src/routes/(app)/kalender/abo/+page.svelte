<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
	let modus = $derived(data.feed.config.departments);
	let kopiert = $state(false);

	async function kopieren() {
		if (!data.feed.url) return;
		try {
			await navigator.clipboard.writeText(data.feed.url);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2500);
		} catch {
			kopiert = false;
		}
	}
	const behalten =
		() =>
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<svelte:head><title>Kalender abonnieren · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/kalender')}>← Kalender</a>
	<div>
		<h1>Kalender abonnieren</h1>
		<p class="hinweis">
			Die Termine erscheinen dann in Outlook oder auf dem Handy und aktualisieren sich von selbst.
		</p>
	</div>
	{#if form?.gespeichert}<p class="meldung" role="status">Auswahl gespeichert.</p>{/if}
	{#if form?.erneuert}<p class="meldung" role="status">
			Neuer Link erzeugt. Der alte funktioniert nicht mehr.
		</p>{/if}
	{#if form?.gesperrt}<p class="meldung" role="status">Link gesperrt.</p>{/if}

	<form method="POST" action="?/speichern" class="karte felder" use:enhance={behalten()}>
		<h2><span class="nr" aria-hidden="true">1</span> Was soll in deinem Kalender erscheinen?</h2>
		<fieldset class="zeile">
			<legend>Für welche Mandanten?</legend>
			<div class="chips">
				{#each data.mandanten as m (m.id)}
					<label class="chip">
						<input
							type="checkbox"
							name="mandanten"
							value={m.id}
							checked={m.eigener || data.feed.config.tenants.includes(m.id)}
							disabled={m.eigener}
						/>
						<span>{m.name}</span>
					</label>
				{/each}
			</div>
			<span class="hinweis">Dein eigener Mandant ist immer dabei.</span>
		</fieldset>
		<fieldset class="zeile">
			<legend>Termine von Abteilungen</legend>
			<div class="chips">
				{#each [['all', 'Alle'], ['selected', 'Ausgewählte'], ['none', 'Keine']] as [wert, text] (wert)}
					<label class="chip">
						<input type="radio" name="abteilungen" value={wert} bind:group={modus} />
						<span>{text}</span>
					</label>
				{/each}
			</div>
			{#if modus === 'selected'}
				<span class="hinweis">Wähl die gewünschten Abteilungen aus:</span>
				<div class="chips">
					{#each data.einheiten as e (e.id)}
						<label class="chip">
							<input
								type="checkbox"
								name="einheiten"
								value={e.id}
								checked={data.feed.config.unitIds.includes(e.id)}
							/>
							<span>{e.name}</span>
						</label>
					{/each}
				</div>
			{/if}
		</fieldset>
		<fieldset class="zeile">
			<legend>Termine von Hubs</legend>
			<div class="chips">
				{#each [['mine', 'Meine Abos'], ['all', 'Alle'], ['none', 'Keine']] as [wert, text] (wert)}
					<label class="chip">
						<input
							type="radio"
							name="hubs"
							value={wert}
							checked={(data.feed.config.hubs ?? 'mine') === wert}
						/>
						<span>{text}</span>
					</label>
				{/each}
			</div>
		</fieldset>
		<p class="hinweis">Der Spielplan kommt dazu, sobald es ihn im Intranet gibt.</p>
		<div>
			<button class="knopf" type="submit">
				{data.feed.url ? 'Auswahl speichern' : 'Speichern und Link erzeugen'}
			</button>
		</div>
	</form>

	<section class="karte stapel" aria-labelledby="h-link">
		<h2 id="h-link">
			<span class="nr" aria-hidden="true">2</span> Link in deinen Kalender übernehmen
		</h2>
		{#if data.feed.url}
			<div class="link">
				<input
					type="text"
					readonly
					value={data.feed.url}
					aria-label="Dein persönlicher Kalender-Link"
					onfocus={(e) => e.currentTarget.select()}
				/>
				<button class="knopf" type="button" onclick={kopieren}>
					{kopiert ? 'Kopiert' : 'Link kopieren'}
				</button>
			</div>
			<span class="sr-only" role="status">{kopiert ? 'Link kopiert' : ''}</span>
			<ul class="anleitung">
				<li><strong>Outlook:</strong> Kalender hinzufügen → Aus dem Internet → Link einfügen.</li>
				<li>
					<strong>iPhone:</strong> Einstellungen → Kalender → Accounts → Account hinzufügen → Andere →
					Kalenderabo.
				</li>
				<li>
					<strong>Android:</strong> Den Link in Google Kalender am PC unter „Per URL hinzufügen“ einfügen.
				</li>
			</ul>
			<p class="hinweis">
				Änderst du oben etwas, bleibt der Link gleich. Dein Kalender zeigt die Änderung beim
				nächsten Abgleich, meist innerhalb weniger Stunden.
			</p>
		{:else if data.feed.revokedAt}
			<p>
				Dein Link ist seit {zeit.format(data.feed.revokedAt)} gesperrt. Speicher oben deine Auswahl, dann
				bekommst du einen neuen Link.
			</p>
		{:else}
			<p>Speicher oben deine Auswahl, dann bekommst du deinen persönlichen Link.</p>
		{/if}
	</section>

	{#if data.feed.url}
		<section class="karte stapel" aria-labelledby="h-schutz">
			<h2 id="h-schutz"><span class="nr" aria-hidden="true">3</span> Link schützen</h2>
			<p>
				Wer diesen Link hat, kann die Termine ohne Anmeldung sehen. Er enthält nur Titel, Zeit, Ort
				und Absender, keine Beschreibungen. Gib ihn nicht weiter.
			</p>
			<div class="aktionen">
				<form method="POST" action="?/erneuern" use:enhance>
					<button class="knopf zweit" type="submit">Neuen Link erzeugen</button>
				</form>
				<MitFrage
					action="?/sperren"
					enhance
					knopf="Link sperren"
					knopfKlasse="knopf zweit rotschrift"
					frage={{
						titel: 'Kalender-Link sperren?',
						text: 'Kalender, die den Link abonniert haben, bekommen keine Termine mehr. Einen neuen Link kannst du jederzeit erzeugen.',
						ja: 'Sperren',
						gefahr: true
					}}
				/>
			</div>
			<p class="hinweis">
				{data.feed.lastFetchedAt
					? `Zuletzt abgerufen: ${zeit.format(data.feed.lastFetchedAt)}.`
					: 'Noch nicht abgerufen.'}
				Wird der Link 12 Monate nicht abgerufen, wird er automatisch gesperrt.
			</p>
		</section>
	{/if}
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.nr {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: var(--fill);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.zeile {
		border: 0;
		margin: 0;
		padding: 10px 0 0;
		border-top: 1px solid var(--bd);
		display: grid;
		gap: 8px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		position: relative;
	}
	.chip input {
		position: absolute;
		opacity: 0;
		inset: 0;
	}
	.chip span {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		cursor: pointer;
	}
	.chip input:checked + span {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.chip input:focus-visible + span {
		outline: 3px solid #2f7de1;
		outline-offset: 2px;
	}
	.chip input:disabled + span {
		cursor: default;
		opacity: 0.85;
	}
	.link {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.link input {
		flex: 1 1 320px;
		font-family: ui-monospace, monospace;
		font-size: 13px;
	}
	.anleitung {
		margin: 0;
		padding-left: 20px;
		display: grid;
		gap: 4px;
		font-size: 14px;
		color: var(--mu);
	}
	.anleitung strong {
		color: var(--tx);
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
