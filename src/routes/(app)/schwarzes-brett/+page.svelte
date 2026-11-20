<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Suchparameter der eigenen Seite, mailto/Teams-Links */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { actionUrl } from '#lib/action-url.ts';

	let { data, form } = $props();
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	let melden = $state<string | null>(null);
	let ablehnen = $state<string | null>(null);
	let loeschen = $state<string | null>(null);

	const GRUENDE = [
		['gewerblich', 'Gewerblich'],
		['unpassend', 'Unpassender Inhalt'],
		['sonstiges', 'Sonstiges']
	] as const;
	const STATUS: Record<string, string> = {
		pending: 'In Prüfung',
		active: 'Online',
		rejected: 'Nicht freigegeben',
		done: 'Erledigt',
		expired: 'Abgelaufen',
		removed: 'Entfernt'
	};
	const weitere = $derived(data.mandanten.filter((m) => m.an && !m.eigener));
	const ausLabel = $derived(
		weitere.length
			? `Anzeigen aus: dein Mandant + ${weitere.map((m) => m.short).join(', ')}`
			: 'Anzeigen aus: dein Mandant'
	);
	const kat = $derived(data.kategorien.find((k) => k.id === data.kategorie));
	const teams = (mail: string) =>
		`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(mail)}`;
	const meta = (a: { author: string; tenantShort: string; createdAt: Date }) =>
		`${a.author} · ${a.tenantShort} · ${datum.format(a.createdAt)}`;
	// Aktionen behalten Ansicht und Filter in der Adresse
	const aktion = (name: string) => actionUrl(page.url.search, name);
	const fertig =
		() =>
		async ({ update }: { update: () => Promise<void> }) => {
			await update();
			melden = null;
			ablehnen = null;
			loeschen = null;
		};
</script>

<svelte:head><title>Schwarzes Brett · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Schwarzes Brett</h1>
			<form method="POST" action={aktion('favorit')} use:enhance>
				<button
					class="stern"
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
				>
					{data.favorit ? '★' : '☆'}
				</button>
			</form>
		</div>
		<a class="knopf" href={resolve('/(app)/schwarzes-brett/neu')}>Anzeige aufgeben</a>
	</div>

	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}
	{#if data.neu}
		<p class="meldung" role="status">
			Danke! Deine Anzeige erscheint, sobald die Moderation sie freigegeben hat.
		</p>
	{/if}

	<nav class="pillen" aria-label="Ansicht">
		<a class="pille" href="?" aria-current={data.ansicht === 'alle' ? 'true' : undefined}>
			Alle Anzeigen
		</a>
		<a
			class="pille"
			href="?ansicht=meine"
			aria-current={data.ansicht === 'meine' ? 'true' : undefined}
		>
			Meine Anzeigen
		</a>
		{#if data.moderator}
			<a
				class="pille"
				href="?ansicht=moderation"
				aria-current={data.ansicht === 'moderation' ? 'true' : undefined}
			>
				Moderation
			</a>
		{/if}
	</nav>

	{#if data.ansicht === 'alle'}
		<form method="GET" class="suche" role="search">
			{#if data.kategorie}<input type="hidden" name="kategorie" value={data.kategorie} />{/if}
			<label class="feld">
				<span class="sr-only">Im Schwarzen Brett suchen</span>
				<input
					type="search"
					name="q"
					value={data.q}
					maxlength="100"
					placeholder="Im Schwarzen Brett suchen …"
				/>
			</label>
			<button class="knopf zweit" type="submit">Suchen</button>
		</form>
		<div class="filter">
			<details class="auf">
				<summary class="pille">{kat ? kat.name : 'Alle Kategorien'} ▾</summary>
				<div class="liste-auf">
					<a
						href={data.q ? `?q=${encodeURIComponent(data.q)}` : '?'}
						aria-current={!data.kategorie ? 'true' : undefined}
					>
						Alle Kategorien
					</a>
					{#each data.kategorien as k (k.id)}
						<a
							href="?kategorie={k.id}{data.q ? `&q=${encodeURIComponent(data.q)}` : ''}"
							aria-current={k.id === data.kategorie ? 'true' : undefined}
						>
							<span>{k.name}</span><span class="hinweis">{k.n}</span>
						</a>
					{/each}
				</div>
			</details>
			<details class="auf">
				<summary class="pille">{ausLabel} ▾</summary>
				<form method="POST" action={aktion('aus')} class="liste-auf">
					<input type="hidden" name="zurueck" value={page.url.search} />
					{#each data.mandanten as m (m.id)}
						<label>
							<input type="checkbox" name="aus" value={m.id} checked={m.an} disabled={m.eigener} />
							<span>{m.name}</span>
							{#if m.eigener}<span class="hinweis">immer dabei</span>{/if}
						</label>
					{/each}
					<span class="hinweis">Wird in deinem Konto gespeichert.</span>
					<button class="knopf klein" type="submit">Übernehmen</button>
				</form>
			</details>
		</div>

		{#if data.anzeigen.length === 0}
			<p class="karte hinweis" role="status">Keine Anzeigen für diese Auswahl.</p>
		{:else}
			<div class="raster">
				{#each data.anzeigen as a (a.id)}
					<article class="karte anzeige" id="anzeige-{a.id}" aria-labelledby="a-{a.id}">
						{#if a.photos.length}
							<div class="bilder">
								{#each a.photos as f (f.id)}
									<a
										href={resolve('/(app)/dateien/[id]', { id: f.id })}
										target="_blank"
										rel="noopener"
									>
										<img
											src={resolve('/(app)/dateien/[id]', { id: f.id })}
											alt="Foto zu „{a.title}“"
											loading="lazy"
										/>
									</a>
								{/each}
							</div>
						{/if}
						<div class="schilder">
							<span class="schild">{a.category}</span>
							{#if a.otherTenant}<span class="schild rand">{a.tenantName}</span>{/if}
						</div>
						<h2 id="a-{a.id}">{a.title}</h2>
						<p class="text">{a.body}</p>
						<span class="hinweis">{meta(a)}</span>
						{#if a.ownContact}<span class="eigen">{a.ownContact}</span>{/if}
						<div class="aktionen">
							{#if !a.mine}
								<form method="POST" action={aktion('nachricht')}>
									<input type="hidden" name="id" value={a.id} />
									<button class="knopf zweit klein" type="submit">Nachricht</button>
								</form>
								{#if a.viaApps}
									<a
										class="knopf zweit klein"
										href={teams(a.authorEmail)}
										target="_blank"
										rel="noopener"
									>
										Teams-Chat
									</a>
									<a
										class="knopf zweit klein"
										href="mailto:{a.authorEmail}?subject={encodeURIComponent(a.title)}"
									>
										E-Mail
									</a>
								{/if}
								<button
									class="linkknopf melden"
									type="button"
									aria-expanded={melden === a.id}
									onclick={() => (melden = melden === a.id ? null : a.id)}
								>
									Melden
								</button>
							{:else}
								<span class="hinweis">Deine Anzeige</span>
							{/if}
						</div>
						{#if melden === a.id}
							<form method="POST" action={aktion('melden')} class="meldeform" use:enhance={fertig}>
								<input type="hidden" name="id" value={a.id} />
								<fieldset>
									<legend>Warum meldest du die Anzeige?</legend>
									{#each GRUENDE as [wert, text] (wert)}
										<label><input type="radio" name="grund" value={wert} required /> {text}</label>
									{/each}
								</fieldset>
								<div class="aktionen">
									<button class="knopf zweit klein" type="button" onclick={() => (melden = null)}>
										Abbrechen
									</button>
									<button class="knopf klein" type="submit">Melden</button>
								</div>
								<span class="hinweis">Die Person erfährt nicht, wer gemeldet hat.</span>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	{:else if data.ansicht === 'meine'}
		<p class="hinweis">
			Anzeigen laufen 30 Tage und lassen sich einmal verlängern. Gespräche mit Interessierten
			schließen, wenn die Anzeige abläuft, erledigt oder gelöscht wird.
		</p>
		{#if data.meine.length === 0}
			<p class="karte hinweis">Du hast noch keine Anzeigen.</p>
		{/if}
		{#each data.meine as a (a.id)}
			<div class="karte zeile">
				<div class="was">
					<div class="schilder">
						<span class="schild" class:rand={a.status !== 'active'}>{STATUS[a.status]}</span>
						<span class="schild rand">{a.category}</span>
					</div>
					<strong>{a.title}</strong>
					<span class="hinweis">
						{#if a.status === 'active' && a.expiresAt}läuft bis {datum.format(
								a.expiresAt
							)}{a.extended ? ' (verlängert)' : ''}{:else if a.status === 'pending'}aufgegeben am {datum.format(
								a.createdAt
							)}{:else if a.rejectReason}Begründung: {a.rejectReason}{:else}aufgegeben am {datum.format(
								a.createdAt
							)}{/if}
					</span>
				</div>
				<div class="aktionen">
					{#if a.status === 'active' && !a.extended}
						<form method="POST" action={aktion('verlaengern')} use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<button class="knopf zweit klein" type="submit">Verlängern</button>
						</form>
					{/if}
					{#if a.status === 'active' || a.status === 'pending'}
						<form method="POST" action={aktion('erledigt')} use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<button class="knopf zweit klein" type="submit">Erledigt</button>
						</form>
					{/if}
					{#if loeschen === a.id}
						<form method="POST" action={aktion('loeschen')} class="aktionen" use:enhance={fertig}>
							<input type="hidden" name="id" value={a.id} />
							<span class="hinweis">Endgültig löschen?</span>
							<button class="knopf klein rot" type="submit">Löschen</button>
							<button class="knopf zweit klein" type="button" onclick={() => (loeschen = null)}>
								Abbrechen
							</button>
						</form>
					{:else}
						<button
							class="knopf zweit klein rotschrift"
							type="button"
							onclick={() => (loeschen = a.id)}
						>
							Löschen
						</button>
					{/if}
				</div>
			</div>
		{/each}
	{:else}
		<p class="hinweis">
			<span class="schild warn">Nur Moderation</span>
			Neue Anzeigen erscheinen erst nach Freigabe. Gemeldete bleiben sichtbar, bis du entscheidest.
		</p>
		{#if data.pruefen.length === 0}
			<p class="karte hinweis">Nichts zu prüfen.</p>
		{/if}
		{#each data.pruefen as a (a.id)}
			{@const gemeldet = a.status === 'active'}
			<div class="karte stapel pruef">
				<div class="schilder">
					<span class="schild" class:warn={gemeldet}>{gemeldet ? 'Gemeldet' : 'Neu'}</span>
					<span class="schild rand">{a.category}</span>
					<span class="schild rand">{a.tenantName}</span>
				</div>
				<strong class="gross">{a.title}</strong>
				<p class="text">{a.body}</p>
				{#if a.photos.length}
					<div class="bilder">
						{#each a.photos as f (f.id)}
							<img src={resolve('/(app)/dateien/[id]', { id: f.id })} alt="Foto zu „{a.title}“" />
						{/each}
					</div>
				{/if}
				<span class="hinweis">
					{meta(a)}{a.ownContact ? ` · Eigene Angaben: ${a.ownContact}` : ''}
				</span>
				{#if gemeldet}
					<span>
						Gemeldet: {a.reports.map((r) => GRUENDE.find(([k]) => k === r)?.[1] ?? r).join(', ')} ({a
							.reports.length}×)
					</span>
				{/if}
				{#if ablehnen === a.id}
					<form method="POST" action={aktion('ablehnen')} class="felder" use:enhance={fertig}>
						<input type="hidden" name="id" value={a.id} />
						<label class="feld">
							<span>Begründung für die Person</span>
							<textarea
								name="begruendung"
								rows="2"
								required
								maxlength="500"
								placeholder="z. B. Gewerbliche Angebote sind nicht erlaubt."></textarea>
						</label>
						<div class="aktionen">
							<button class="knopf klein rot" type="submit">
								{gemeldet ? 'Anzeige entfernen' : 'Ablehnen'}
							</button>
							<button class="knopf zweit klein" type="button" onclick={() => (ablehnen = null)}>
								Abbrechen
							</button>
						</div>
					</form>
				{:else}
					<div class="aktionen">
						<form method="POST" action={aktion(gemeldet ? 'behalten' : 'freigeben')} use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<button class="knopf klein" type="submit">
								{gemeldet ? 'Meldung zurückweisen' : 'Freigeben'}
							</button>
						</form>
						<form method="POST" action={aktion('rueckfrage')}>
							<input type="hidden" name="id" value={a.id} />
							<button class="knopf zweit klein" type="submit">Rückfrage</button>
						</form>
						<button
							class="knopf zweit klein rotschrift"
							type="button"
							onclick={() => (ablehnen = a.id)}
						>
							{gemeldet ? 'Entfernen' : 'Ablehnen'}
						</button>
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	h1 {
		margin: 0;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
	}
	.pillen,
	.filter {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.pille {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		text-decoration: none;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	.pille::-webkit-details-marker {
		display: none;
	}
	.pille[aria-current='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.suche {
		display: flex;
		gap: 10px;
		max-width: 640px;
	}
	.suche .feld {
		flex: 1;
	}
	.auf {
		position: relative;
	}
	.liste-auf {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 30;
		min-width: 260px;
		display: grid;
		gap: 2px;
		padding: 8px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
	}
	.liste-auf a,
	.liste-auf label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 44px;
		padding: 0 8px;
		border-radius: 10px;
		color: var(--tx);
		text-decoration: none;
	}
	.liste-auf a[aria-current='true'] {
		background: var(--tint);
		font-weight: 600;
	}
	.liste-auf label {
		justify-content: flex-start;
	}
	.liste-auf input {
		width: 18px;
		height: 18px;
		accent-color: var(--fill);
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.anzeige {
		display: grid;
		gap: 8px;
	}
	.anzeige h2 {
		margin: 0;
		font-size: 18px;
		line-height: 1.3;
	}
	.text {
		margin: 0;
		line-height: 1.5;
		white-space: pre-line;
	}
	.bilder {
		display: flex;
		gap: 6px;
		overflow-x: auto;
	}
	.bilder img {
		height: 150px;
		max-width: 100%;
		object-fit: cover;
		border-radius: 12px;
	}
	.pruef .bilder img {
		height: 110px;
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.schild.warn {
		background: #fef0c7;
		color: #7a2e0e;
	}
	.eigen {
		font-size: 14px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.anzeige > .aktionen {
		padding-top: 8px;
		border-top: 1px solid var(--bd);
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.melden {
		margin-left: auto;
		font-size: 13px;
		color: var(--mu);
	}
	.meldeform {
		display: grid;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--bg);
		border: 1px solid var(--bd);
	}
	.meldeform fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.meldeform label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
	}
	.was {
		flex: 1 1 260px;
		min-width: 0;
		display: grid;
		gap: 4px;
	}
	.gross {
		font-size: 17px;
	}
	.rot {
		background: #b42318;
		border-color: #b42318;
		color: #fff;
	}
	.rotschrift {
		color: #b42318;
	}
</style>
