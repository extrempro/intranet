<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { dayHeading, timeLabel } from '#lib/calendar.ts';
	import { berlinNow } from '#lib/canteen.ts';
	import { groupResponsibilities, matchesSearch } from '#lib/departments.ts';
	import { formatDay } from '#lib/news.ts';

	let { data, form } = $props();
	const e = $derived(data.einheit);
	const heute = berlinNow().date;
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	let suche = $state('');

	const gefiltert = $derived(
		e.zustaendigkeiten.filter((z) =>
			matchesSearch(suche, [z.topic, z.description, z.groupName, ...z.keywords, z.kontakt?.name])
		)
	);
	const gruppen = $derived(groupResponsibilities(gefiltert));
	const leitung = $derived(
		[
			e.leitung && { rolle: 'Leitung', p: e.leitung },
			e.zweiteLeitung && { rolle: 'Leitung', p: e.zweiteLeitung },
			e.stellvertretung && { rolle: 'Stellvertretung', p: e.stellvertretung }
		].filter(Boolean) as { rolle: string; p: { id: string; name: string; email: string } }[]
	);
	const extern = (url: string) => !url.startsWith('/');
</script>

<svelte:head><title>{e.name} · Abteilungen · Intranet</title></svelte:head>

<div class="stapel">
	<a class="zurueck" href={resolve('/(app)/abteilungen')}>← Abteilungen</a>
	<div class="kopfzeile">
		<div class="stapel eng">
			<div class="titel">
				<h1>{e.name}</h1>
				<form method="POST" action="?/favorit" use:enhance>
					<button
						class="stern"
						type="submit"
						aria-pressed={data.favorit}
						aria-label={data.favorit
							? 'Aus den Favoriten entfernen'
							: 'Zu den Favoriten hinzufügen'}
					>
						{data.favorit ? '★' : '☆'}
					</button>
				</form>
			</div>
			<p class="hinweis">
				{e.label} · {e.isCentral ? 'für alle Mandanten' : e.tenantName}
			</p>
			{#if leitung.length}
				<dl class="leitung">
					{#each leitung as l (l.p.id)}
						<div>
							<dt>{l.rolle}</dt>
							<dd><a href="mailto:{l.p.email}">{l.p.name}</a></dd>
						</div>
					{/each}
				</dl>
			{/if}
		</div>
		{#if e.canManage || e.canAdminister}
			<a
				class="knopf zweit"
				href={resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: e.slug })}
			>
				Seite bearbeiten
			</a>
		{/if}
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	{#if (e.canManage || e.canAdminister) && e.pruefung.ueberfaellig}
		<div class="meldung pruefen" role="status">
			<span>
				Die Zuständigkeiten wurden zuletzt am {datum.format(e.pruefung.geprueftAm!)} geprüft. Passt noch
				alles?
			</span>
			<form method="POST" action="?/geprueft" use:enhance>
				<button class="knopf klein" type="submit">Alles geprüft</button>
			</form>
		</div>
	{/if}

	<div class="spalten">
		<div class="stapel">
			{#if e.zustaendigkeiten.length}
				<section class="karte stapel" aria-labelledby="h-wer">
					<h2 id="h-wer">Wer hilft bei was?</h2>
					{#if e.zustaendigkeiten.length > 5}
						<label class="sr-only" for="zsuche">Zuständigkeiten durchsuchen</label>
						<input
							id="zsuche"
							type="search"
							bind:value={suche}
							placeholder="Thema oder Stichwort"
							autocomplete="off"
							maxlength="100"
						/>
					{/if}
					{#if gefiltert.length === 0}
						<p class="hinweis">Nichts gefunden.</p>
					{/if}
					{#each gruppen as g (g.group)}
						<div class="gruppe">
							{#if g.group}<h3>{g.group}</h3>{/if}
							<ul class="zliste">
								{#each g.items as z (z.id)}
									<li>
										<div class="zkopf">
											<strong>{z.topic}</strong>
											{#if z.kontakt}
												<span class="kontakt">
													<a href="mailto:{z.kontakt.email}">{z.kontakt.name}</a>
													{#if z.kontakt.vertretung}<span class="schild">Vertretung</span>{/if}
													{#if z.kontakt.phone}
														<span class="hinweis">
															· <a href="tel:{z.kontakt.phone}">{z.kontakt.phone}</a>
														</span>
													{/if}
												</span>
											{/if}
										</div>
										{#if z.description}<p class="text">{z.description}</p>{/if}
										{#if z.keywords.length || z.links.length}
											<div class="zfuss">
												{#each z.keywords as k (k)}<span class="stichwort">{k}</span>{/each}
												{#each z.links as l (l.url)}
													<a
														href={l.url}
														target={extern(l.url) ? '_blank' : undefined}
														rel={extern(l.url) ? 'noopener noreferrer' : undefined}
													>
														{l.label}
													</a>
												{/each}
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/if}

			{#if e.team.length}
				<section class="karte stapel" aria-labelledby="h-team">
					<h2 id="h-team">Team</h2>
					<ul class="team">
						{#each e.team as m (m.id)}
							<li>
								<strong>{m.name}</strong>
								{#if m.position}<span class="hinweis">{m.position}</span>{/if}
								<span class="hinweis">
									<a href="mailto:{m.email}">{m.email}</a>
									{#if m.phone}· <a href="tel:{m.phone}">{m.phone}</a>{/if}
									{#if m.mobile}· <a href="tel:{m.mobile}">{m.mobile}</a>{/if}
									{#if m.room}· Raum {m.room}{/if}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if e.about}
				<section class="karte" aria-labelledby="h-ueber">
					<h2 id="h-ueber">Über uns</h2>
					<p class="text">{e.about}</p>
				</section>
			{/if}

			{#if !e.zustaendigkeiten.length && !e.team.length && !e.about}
				<p class="karte hinweis">Für diese Seite ist noch nichts eingetragen.</p>
			{/if}
		</div>

		<aside class="stapel">
			{#if e.termine.length || e.canEvents}
				<section class="karte" aria-labelledby="h-termine">
					<div class="zeilenkopf">
						<h2 id="h-termine">Nächste Termine</h2>
						{#if e.canEvents}
							<a class="klein-link" href="{resolve('/(app)/kalender/neu')}?absender={e.id}">
								Termin anlegen
							</a>
						{/if}
					</div>
					{#if e.termine.length === 0}
						<p class="hinweis">Keine anstehenden Termine.</p>
					{/if}
					<ul class="liste">
						{#each e.termine as t (t.id)}
							<li>
								<a href={resolve('/(app)/kalender/[id]', { id: t.id })}>{t.title}</a>
								<span class="hinweis">
									{dayHeading(t.date, heute)} · {timeLabel(t)}{t.place ? ` · ${t.place}` : ''}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data.beitraege.length || e.canPost}
				<section class="karte" aria-labelledby="h-beitraege">
					<div class="zeilenkopf">
						<h2 id="h-beitraege">Beiträge</h2>
						{#if e.canPost}
							<a class="klein-link" href="{resolve('/(app)/neuigkeiten/neu')}?absender={e.id}">
								Beitrag schreiben
							</a>
						{/if}
					</div>
					{#if data.beitraege.length === 0}
						<p class="hinweis">Noch keine Beiträge.</p>
					{/if}
					<ul class="liste">
						{#each data.beitraege as b (b.id)}
							<li>
								<a href={resolve('/(app)/neuigkeiten/[id]', { id: b.id })}>{b.title}</a>
								<span class="hinweis">{formatDay(b.publishAt)}</span>
							</li>
						{/each}
					</ul>
					{#if data.beitraege.length}
						<a class="klein-link" href="{resolve('/(app)/neuigkeiten')}?von={e.id}">
							Alle Beiträge
						</a>
					{/if}
				</section>
			{/if}

			{#if e.faqs.length || e.canFaqs}
				<section class="karte" aria-labelledby="h-faqs">
					<div class="zeilenkopf">
						<h2 id="h-faqs">FAQs</h2>
						{#if e.canFaqs}
							<a class="klein-link" href="{resolve('/(app)/faqs/neu')}?einheit={e.id}">
								FAQ anlegen
							</a>
						{/if}
					</div>
					{#if e.faqs.length === 0}
						<p class="hinweis">Noch keine FAQs.</p>
					{/if}
					<ul class="liste">
						{#each e.faqs as f (f.id)}
							<li>
								<a href="{resolve('/(app)/faqs')}?einheit={e.id}#faq-{f.id}">{f.question}</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</aside>
	</div>
</div>

<style>
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.eng {
		gap: 4px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	h3 {
		font-size: 0.95rem;
		color: var(--mu);
		margin-bottom: 4px;
	}
	.hinweis {
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
	.leitung {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 24px;
		margin: 4px 0 0;
	}
	.leitung dt {
		font-size: 13px;
		color: var(--mu);
	}
	.leitung dd {
		margin: 0;
		font-weight: 600;
	}
	.pruefen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.spalten {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
		gap: 18px;
		align-items: start;
	}
	@media (max-width: 899px) {
		.spalten {
			grid-template-columns: 1fr;
		}
	}
	input[type='search'] {
		width: 100%;
	}
	.zliste,
	.team,
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.zliste li,
	.team li {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zkopf {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
	}
	.kontakt {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.zfuss {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
		align-items: center;
		font-size: 14px;
	}
	.stichwort {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--tint);
		color: var(--mu);
		font-size: 13px;
	}
	.liste {
		gap: 10px;
	}
	.liste li {
		display: flex;
		flex-direction: column;
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.zeilenkopf {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.klein-link {
		font-size: 14px;
		font-weight: 600;
	}
</style>
