<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import Info from '#lib/components/Info.svelte';
	import { FAVORITES_MAX } from '#lib/home.ts';
	import { moveItem } from '#lib/home.ts';
	import { formatDay, formatWhen } from '#lib/news.ts';
	import { timeLabel } from '#lib/calendar.ts';
	import { closureRange, closureTitle } from '#lib/canteen.ts';
	import { formatRange } from '#lib/plans.ts';

	let { data, form } = $props();

	let bearbeiten = $state(false);
	let karten = $state<typeof data.karten>([]);
	let favoriten = $state<typeof data.favoriten>([]);

	function starten() {
		karten = structuredClone(data.karten);
		favoriten = structuredClone(data.favoriten);
		bearbeiten = true;
	}

	const sichtbareKarten = $derived(data.karten.filter((k) => k.visible));
	const zeigePlaene = $derived(sichtbareKarten.some((k) => k.id === 'plaene'));
	/** „Für dich“: Neuigkeiten und die übrigen Karten (ohne Pläne) in der eingestellten Reihenfolge */
	const fuerDich = $derived(
		sichtbareKarten.filter(
			(k) => k.id !== 'plaene' && (k.id !== 'umfragen' || data.umfragen.length > 0)
		)
	);
	const mitNeuigkeiten = $derived(fuerDich.some((k) => k.id === 'neuigkeiten'));
	const leer: Record<string, boolean> = $derived({
		neuigkeiten: data.neuigkeiten.length === 0,
		hubs: data.hubBeitraege.length === 0,
		termine: data.termine.items.length === 0,
		speiseplan: data.kantinen.length === 0,
		umfragen: data.umfragen.length === 0
	});
	/** PC: leere Karten rechts ausblenden; sind alle leer, steht dort „So geht es los“ */
	const seiteLeer = $derived(
		fuerDich.filter((k) => k.id !== 'neuigkeiten').every((k) => leer[k.id])
	);
	const KURZ: Record<string, string> = {
		neuigkeiten: 'Neues',
		hubs: 'Hubs',
		termine: 'Termine',
		speiseplan: 'Kantine',
		umfragen: 'Umfragen'
	};
	const SYMBOL: Record<string, string> = {
		neuigkeiten: 'M4 5h12v14h-10a2 2 0 0 1 -2 -2zM16 9h4v8a2 2 0 0 1 -2 2M8 9h4M8 13h4',
		hubs: 'M12 3l8 4.5v9l-8 4.5l-8 -4.5v-9zM12 12l8 -4.5M12 12v9M12 12l-8 -4.5',
		termine:
			'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16',
		speiseplan: 'M4 3v8a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-8M7 3v18M17 3c-2 2 -3 5 -3 8h3v10',
		umfragen: 'M4 20h16M7 16v-4M12 16v-9M17 16v-6'
	};
	// Handy: ein Bereich zur Zeit
	let gewaehlt = $state<string | null>(null);
	const tab = $derived(
		gewaehlt && fuerDich.some((k) => k.id === gewaehlt) ? gewaehlt : (fuerDich[0]?.id ?? '')
	);
	/** Ungelesen: nach dem letzten Besuch der Neuigkeiten erschienen */
	const ungelesen = (d: Date | string) =>
		data.neuSeit !== null && new Date(d).getTime() > new Date(data.neuSeit).getTime();
	const neuZahl = $derived(data.neuigkeiten.filter((n) => ungelesen(n.publishAt)).length);
	/** Aufmacher: angeheftet oder mit Bild bevorzugt, sonst der neueste */
	const aufmacher = $derived(
		data.neuigkeiten.find((n) => n.pinned && n.vorschau.bilder.length) ??
			data.neuigkeiten.find((n) => n.vorschau.bilder.length) ??
			data.neuigkeiten[0]
	);
	const weitere = $derived(data.neuigkeiten.filter((n) => n !== aufmacher).slice(0, 3));
	const TABELLE = 'M3 5h18v14h-18zM3 10h18M3 15h18M9 5v14';
	const TEXT = 'M5 6h14M5 10h14M5 14h10M5 18h6';
	const monat = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' });
	const tagMonat = (iso: string) => {
		const d = new Date(`${iso}T12:00:00Z`);
		return { tag: d.getUTCDate(), monat: monat.format(d).replace('.', '') };
	};
	const WARNUNG =
		'M12 9v4M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0zM12 16h.01';
	const PIN = 'M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4M9 15l-4.5 4.5M14.5 4l5.5 5.5';

	const zuruecksetzen: SubmitFunction =
		() =>
		async ({ update }) => {
			await update();
			bearbeiten = false;
		};
</script>

<svelte:head><title>Start · Intranet</title></svelte:head>

<div class="start">
	<div class="kopfzeile">
		<div>
			<h1>{data.gruss}</h1>
			<p class="unterzeile">{data.ich.mandant} · {data.datum}</p>
		</div>
		{#if !bearbeiten}
			<button type="button" class="knopf zweit klein" onclick={starten}>
				Startseite anpassen
			</button>
		{/if}
	</div>

	{#if form?.gespeichert}<p class="meldung" role="status">Deine Startseite ist gespeichert.</p>{/if}
	{#if form?.zurueckgesetzt}<p class="meldung" role="status">
			Die Startseite ist auf den Standard zurückgesetzt.
		</p>{/if}
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<!-- Dringende Meldungen stehen immer oben (Kap. 8.2) -->
	{#if data.dringend.length}
		<section aria-label="Dringende Meldungen" class="dringende">
			{#each data.dringend as d (d.id)}
				<article class="banner" aria-labelledby="dr-{d.id}">
					<span class="warnsymbol" aria-hidden="true">
						<Icon d={WARNUNG} size={22} stroke={2} />
					</span>
					<div class="banner-inhalt">
						<div class="banner-kopf">
							<span class="dringend">Dringend</span>
							<span class="quelle">{d.sender}</span>
							{#if d.audience}<span class="schild rand">{d.audience}</span>{/if}
						</div>
						<h2 id="dr-{d.id}">{d.title}</h2>
						{#if d.text}<p>{d.text}</p>{/if}
						<div class="banner-aktionen">
							<form
								method="POST"
								action="/neuigkeiten/{d.id}?/zuklappen"
								use:enhance={() =>
									async ({ update }) =>
										update({ invalidateAll: true })}
							>
								<button class="knopf klein" type="submit">Gelesen, zuklappen</button>
							</form>
							<a class="knopf zweit klein" href={resolve('/(app)/neuigkeiten/[id]', { id: d.id })}>
								Zur Meldung
							</a>
							<span class="bis">Dringend bis {formatWhen(d.until)}</span>
						</div>
					</div>
				</article>
			{/each}
		</section>
	{/if}

	<section class="favoritenbereich" aria-labelledby="fav-h" data-tour="favoriten">
		<h2 id="fav-h" class="mit-info">
			Favoriten
			<Info
				thema="Favoriten"
				text="Tippe auf einer Seite auf den Stern ☆, um sie hier anzuheften. Mit „Startseite anpassen“ sortierst oder entfernst du sie."
			/>
		</h2>
		{#if (bearbeiten ? favoriten : data.favoriten).length === 0}
			<p class="hinweis">
				Noch keine Favoriten. Tippe auf einer Seite auf den Stern ☆, um sie hier anzuzeigen.
			</p>
		{:else}
			<ul class="favoriten">
				{#each bearbeiten ? favoriten : data.favoriten as f, i (f.key)}
					<li class="karte fav">
						{#if bearbeiten}
							<span class="fav-inhalt"><Icon d={f.icon} /><strong>{f.label}</strong></span>
							<span class="werkzeuge">
								<button
									type="button"
									class="mini"
									aria-label="{f.label} nach links"
									disabled={i === 0}
									onclick={() => (favoriten = moveItem(favoriten, i, -1))}
								>
									←
								</button>
								<button
									type="button"
									class="mini"
									aria-label="{f.label} nach rechts"
									disabled={i === favoriten.length - 1}
									onclick={() => (favoriten = moveItem(favoriten, i, 1))}
								>
									→
								</button>
								<button
									type="button"
									class="mini"
									aria-label="{f.label} entfernen"
									onclick={() => (favoriten = favoriten.filter((x) => x.key !== f.key))}
								>
									×
								</button>
							</span>
						{:else}
							<!-- href stammt aus der festen Zielliste auf dem Server -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a class="fav-inhalt" href={f.href} title={f.beschreibung || undefined}>
								<span class="fav-symbol"><Icon d={f.icon} size={20} stroke={1.8} /></span>
								<strong>{f.label}</strong>
							</a>
						{/if}
					</li>
				{/each}
			</ul>
			<span class="zaehlung">
				{(bearbeiten ? favoriten : data.favoriten).length} von {FAVORITES_MAX} Favoriten
			</span>
		{/if}
	</section>

	{#if bearbeiten}
		<section class="karte bearbeiten" aria-labelledby="karten-h">
			<h2 id="karten-h">Karten</h2>
			{#if karten.length === 0}
				<p class="hinweis">Weitere Karten kommen dazu, sobald es die Funktionen gibt.</p>
			{:else}
				<ul class="kartenliste">
					{#each karten as k, i (k.id)}
						<li>
							<label class="schalter">
								<input type="checkbox" role="switch" bind:checked={k.visible} />
								{k.label}
							</label>
							<span class="werkzeuge">
								<button
									type="button"
									class="mini"
									aria-label="{k.label} nach oben"
									disabled={i === 0}
									onclick={() => (karten = moveItem(karten, i, -1))}
								>
									↑
								</button>
								<button
									type="button"
									class="mini"
									aria-label="{k.label} nach unten"
									disabled={i === karten.length - 1}
									onclick={() => (karten = moveItem(karten, i, 1))}
								>
									↓
								</button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
			<div class="aktionen">
				<form
					method="POST"
					action="?/speichern"
					use:enhance={() =>
						async ({ update }) => {
							await update();
							bearbeiten = false;
						}}
				>
					<input type="hidden" name="reihenfolge" value={JSON.stringify(karten.map((k) => k.id))} />
					<input
						type="hidden"
						name="ausgeblendet"
						value={JSON.stringify(karten.filter((k) => !k.visible).map((k) => k.id))}
					/>
					<input
						type="hidden"
						name="favoriten"
						value={JSON.stringify(favoriten.map((f) => f.key))}
					/>
					<button class="knopf" type="submit">Fertig</button>
				</form>
				<button type="button" class="knopf zweit" onclick={() => (bearbeiten = false)}>
					Abbrechen
				</button>
				{#if data.eigeneEinstellung}
					<MitFrage
						action="?/zuruecksetzen"
						knopf="Auf Standard zurücksetzen"
						enhance={zuruecksetzen}
						frage={{
							titel: 'Startseite zurücksetzen?',
							text: 'Deine Anordnung der Startseite wird durch die Voreinstellung ersetzt.',
							ja: 'Zurücksetzen'
						}}
					/>
				{/if}
			</div>
		</section>
	{/if}

	{#if !bearbeiten && zeigePlaene}
		<section class="plaene" aria-labelledby="plaene-h">
			<div class="kartenkopf">
				<h2 id="plaene-h">Aktuelle Pläne</h2>
				<a class="aktionslink" href={resolve('/(app)/plaene')}>Alle Pläne</a>
			</div>
			{#if data.plaene.length === 0}
				<p class="hinweis leerhinweis">
					Sobald aktuelle Pläne veröffentlicht sind, stehen sie hier.
				</p>
			{:else}
				<ul class="planliste">
					{#each data.plaene as pl (pl.id)}
						{@const d = tagMonat(pl.validFrom)}
						<li>
							<a class="karte plankachel" href={resolve('/(app)/plaene/[id]', { id: pl.id })}>
								<span class="plandatum" aria-hidden="true"><strong>{d.tag}</strong>{d.monat}</span>
								<span class="was">
									<strong class="plantitel">{pl.title}</strong>
									<span class="meta">{formatRange(pl.validFrom, pl.validUntil)}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if !bearbeiten && fuerDich.length}
		<section class="fuerdich" class:ohne-neues={!mitNeuigkeiten} aria-labelledby="fuerdich-h">
			<h2 id="fuerdich-h" class="nur-handy">Für dich</h2>
			{#if fuerDich.length > 1}
				<div class="bereiche nur-handy" role="tablist" aria-label="Für dich">
					{#each fuerDich as k (k.id)}
						<button
							type="button"
							role="tab"
							id="tab-{k.id}"
							aria-selected={tab === k.id}
							aria-controls="bereich-{k.id}"
							onclick={() => (gewaehlt = k.id)}
						>
							<span class="bereichssymbol" aria-hidden="true">
								<Icon d={SYMBOL[k.id]} size={20} stroke={2} />
								{#if k.id === 'neuigkeiten' && neuZahl}<span class="zahl">{neuZahl}</span>{/if}
							</span>
							<span>{KURZ[k.id]}</span>
							{#if k.id === 'neuigkeiten' && neuZahl}<span class="sr-only">
									, {neuZahl} neu
								</span>{/if}
						</button>
					{/each}
				</div>
			{/if}
			{#each fuerDich as k (k.id)}
				{#if k.id === 'neuigkeiten'}
					<section
						id="bereich-neuigkeiten"
						class="karte block neuigkeiten"
						class:aus={tab !== k.id}
						aria-labelledby="karte-neuigkeiten"
					>
						<div class="kartenkopf">
							<h2 id="karte-neuigkeiten">
								Neuigkeiten{#if neuZahl}&nbsp;<span class="neuschild">{neuZahl} neu</span>{/if}
							</h2>
							<a class="aktionslink" href={resolve('/(app)/neuigkeiten')}>Alle Neuigkeiten</a>
						</div>
						{#if !aufmacher}
							<p class="hinweis">
								Noch keine Neuigkeiten für dich. Sobald etwas veröffentlicht wird, steht es hier.
							</p>
						{:else}
							<article class="aufmacher">
								{#if aufmacher.vorschau.bilder.length}
									<img
										class="aufmacherbild"
										src={aufmacher.vorschau.bilder[0]}
										alt=""
										loading="lazy"
									/>
								{/if}
								<div class="aufmachertext">
									<div class="schilder">
										{#if aufmacher.pinned}<span class="schild mit-symbol">
												<Icon d={PIN} size={12} stroke={2.2} />Angeheftet
											</span>{/if}
										{#if aufmacher.urgent && aufmacher.urgentUntil}<span class="schild rot">
												Dringend bis {formatWhen(aufmacher.urgentUntil)}
											</span>{/if}
									</div>
									<h3>
										<a
											class="dehnen titellink"
											href={resolve('/(app)/neuigkeiten/[id]', { id: aufmacher.id })}
										>
											{#if ungelesen(aufmacher.publishAt)}<span class="punkt" aria-hidden="true"
												></span><span class="sr-only">Neu: </span>{/if}{aufmacher.title}
										</a>
									</h3>
									<span class="meta">
										{aufmacher.sender.name} · {formatDay(aufmacher.publishAt)}
									</span>
									{#if aufmacher.excerpt}<p class="auszug">{aufmacher.excerpt}</p>{/if}
								</div>
							</article>
							{#if weitere.length}
								<ul class="zeilen">
									{#each weitere as n (n.id)}
										<li class="kurz mitvorschau">
											{#if n.vorschau.bilder.length}
												<img class="mini" src={n.vorschau.bilder[0]} alt="" loading="lazy" />
											{:else}
												<span class="mini ohnebild" aria-hidden="true">
													<Icon d={n.vorschau.hatTabelle ? TABELLE : TEXT} size={18} stroke={1.8} />
												</span>
											{/if}
											<span class="was">
												<a
													class="dehnen titellink"
													href={resolve('/(app)/neuigkeiten/[id]', { id: n.id })}
												>
													{#if ungelesen(n.publishAt)}<span class="punkt" aria-hidden="true"
														></span><span class="sr-only">Neu: </span>{/if}{n.title}
												</a>
												<span class="meta">{n.sender.name} · {formatDay(n.publishAt)}</span>
											</span>
										</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</section>
				{:else if k.id === 'hubs'}
					<section
						id="bereich-hubs"
						class="karte block seite"
						class:aus={tab !== k.id}
						class:leer={leer.hubs}
						aria-labelledby="karte-hubs"
					>
						<div class="kartenkopf">
							<h2 id="karte-hubs">Neu in deinen Hubs</h2>
							<a class="aktionslink" href={resolve('/(app)/aus-den-hubs')}>Alle</a>
						</div>
						{#if data.hubBeitraege.length === 0}
							<p class="hinweis">
								Keine neuen Beiträge. <a href={resolve('/(app)/hubs')}>Hubs entdecken</a>
							</p>
						{:else}
							<ul class="zeilen">
								{#each data.hubBeitraege as n (n.id)}
									<li class="kurz">
										<span class="hubname">{n.sender.name}</span>
										<a
											class="dehnen titellink"
											href={resolve('/(app)/neuigkeiten/[id]', { id: n.id })}
										>
											{n.title}
										</a>
										<span class="meta">{formatDay(n.publishAt)}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{:else if k.id === 'umfragen'}
					<section
						id="bereich-umfragen"
						class="karte block seite"
						class:aus={tab !== k.id}
						aria-labelledby="karte-umfragen"
					>
						<div class="kartenkopf">
							<h2 id="karte-umfragen">Offene Umfragen</h2>
						</div>
						<ul class="zeilen">
							{#each data.umfragen as o (o.newsId)}
								<li class="kurz">
									<span class="hubname">{o.von}</span>
									<a
										class="dehnen titellink"
										href="{resolve('/(app)/neuigkeiten/[id]', { id: o.newsId })}#umfrage-titel"
									>
										{o.titel}
									</a>
									<span class="meta">
										{o.fragen === 1 ? '1 Frage' : `${o.fragen} Fragen`} · bis {formatDay(o.endsAt)}
									</span>
								</li>
							{/each}
						</ul>
					</section>
				{:else if k.id === 'termine'}
					<section
						id="bereich-termine"
						class="karte block seite"
						class:aus={tab !== k.id}
						class:leer={leer.termine}
						aria-labelledby="karte-termine"
					>
						<div class="kartenkopf">
							<h2 id="karte-termine">Heute und morgen</h2>
							<a class="aktionslink" href={resolve('/(app)/kalender')}>Kalender</a>
						</div>
						{#if data.termine.items.length === 0}
							<p class="hinweis">Heute und morgen stehen keine Termine an.</p>
						{:else}
							<ul class="zeilen">
								{#each data.termine.items as t (t.id)}
									<li class="termin">
										<span class="wann">
											{t.date === data.termine.today ? 'Heute' : 'Morgen'}
											{timeLabel(t)}
										</span>
										<span
											class="balken"
											class:quelle-einheit={!t.isHub}
											class:fremd={!t.own}
											aria-hidden="true"
										></span>
										<span class="was">
											<a
												class="dehnen titellink"
												href={resolve('/(app)/kalender/[id]', { id: t.id })}
											>
												{t.title}
											</a>
											<span class="meta">
												{[t.unitName, t.place].filter(Boolean).join(' · ')}
											</span>
										</span>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{:else if k.id === 'speiseplan'}
					<section
						id="bereich-speiseplan"
						class="karte block seite"
						class:aus={tab !== k.id}
						class:leer={leer.speiseplan}
						aria-labelledby="karte-speiseplan"
					>
						<div class="kartenkopf">
							<h2 id="karte-speiseplan">Speiseplan</h2>
							<a class="aktionslink" href={resolve('/(app)/speiseplan')}>Öffnen</a>
						</div>
						{#if data.kantinen.length === 0}
							<p class="hinweis">
								Wähl unter <a href={resolve('/(app)/konto/standorte')}>Meine Standorte</a> deine Kantine
								aus.
							</p>
						{:else}
							{#each data.kantinen as kt (kt.id)}
								<div class="kantine">
									<span class="pdf" aria-hidden="true">PDF</span>
									<span class="was">
										<strong>{kt.name}</strong>
										<span class="meta">
											{kt.current ? kt.current.title : 'Noch kein Speiseplan für diese Woche'}
										</span>
									</span>
									<span class="schild" class:rand={!kt.status.open} class:zu={kt.activeClosure}>
										{kt.activeClosure ? closureTitle(kt.activeClosure) : kt.status.text}
									</span>
								</div>
								{#each kt.announced as c (c.id)}
									<p class="demnaechst">
										<strong>Demnächst geschlossen:</strong>
										{closureRange(c)}
									</p>
								{/each}
							{/each}
						{/if}
					</section>
				{/if}
			{/each}
			{#if seiteLeer && fuerDich.some((k) => k.id !== 'neuigkeiten')}
				<section class="karte block losgehts nur-pc" aria-labelledby="los-h">
					<h2 id="los-h">So geht es los</h2>
					<p class="hinweis">
						Hier erscheinen Hubs, Termine und die Kantine, sobald es etwas gibt.
					</p>
					<ul class="loslinks">
						<li><a href={resolve('/(app)/hubs')}>Hubs entdecken und abonnieren</a></li>
						<li><a href={resolve('/(app)/konto/standorte')}>Deine Kantine wählen</a></li>
						<li><a href={resolve('/(app)/kalender')}>Zum Kalender</a></li>
					</ul>
				</section>
			{/if}
		</section>
	{/if}
</div>

<style>
	.start {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px 12px;
	}
	h1 {
		margin: 0;
	}
	.unterzeile {
		margin: 4px 0 0;
		color: var(--mu);
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	.klein {
		min-height: 40px;
		padding: 6px 14px;
		font-size: 14px;
	}

	/* Dringend */
	.dringende {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.banner {
		display: flex;
		gap: 14px;
		padding: 16px;
		border-radius: 16px;
		background: var(--err-bg);
		border: 2px solid var(--err-bd);
		color: var(--tx);
	}
	.warnsymbol {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--rot);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.banner-inhalt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.banner-kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		font-size: 13px;
	}
	.dringend {
		font-weight: 700;
		color: var(--err-tx);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.quelle {
		font-weight: 600;
	}
	.banner h2 {
		font-size: 19px;
		line-height: 1.3;
	}
	.banner p {
		margin: 0;
	}
	.banner-aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-top: 4px;
	}
	.bis {
		font-size: 13px;
		color: var(--mu);
	}

	/* Favoriten */
	section[aria-labelledby='fav-h'] {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.mit-info {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	/* Favoriten als Kacheln: Symbol und Name */
	.favoriten {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 10px;
	}
	.fav {
		padding: 0;
		min-height: 88px;
		display: flex;
		flex-direction: column;
	}
	.fav-inhalt {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 8px;
		color: var(--tx);
		text-align: center;
		text-decoration: none;
		border-radius: var(--radius);
	}
	.fav-symbol {
		display: inline-grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--tint);
		color: var(--ac);
	}
	.fav-inhalt strong {
		font-weight: 600;
		font-size: 13px;
		line-height: 1.25;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	a.fav-inhalt:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
	}
	.zaehlung {
		font-size: 13px;
		color: var(--mu);
	}
	.werkzeuge {
		display: flex;
		gap: 4px;
		padding: 0 12px 12px;
	}
	.kartenliste .werkzeuge {
		padding: 0;
	}
	.mini {
		min-width: 40px;
		min-height: 40px;
		border-radius: 10px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		font-size: 18px;
		cursor: pointer;
	}
	.mini:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.kartenliste {
		list-style: none;
		margin: 0 0 12px;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.kartenliste li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.schalter {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.schalter input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.kartenkopf {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.kartenkopf .aktionslink {
		min-height: 44px;
	}
	.kurz {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 6px 6px;
		margin: 0 -6px;
		border-top: 1px solid var(--bd);
		border-radius: 10px;
	}
	.kurz:hover {
		background: var(--bg);
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.schilder:empty {
		display: none;
	}
	.mit-symbol {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.schild.rot {
		background: var(--rot);
		color: #fff;
	}
	.dehnen::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.zeilen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zeilen li {
		position: relative;
	}
	.zeilen .kurz {
		gap: 2px;
		padding-top: 8px;
	}
	.meta {
		font-size: 13px;
		color: var(--mu);
	}
	.termin {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
	}
	.wann {
		flex: none;
		width: 84px;
		font-size: 13px;
		font-weight: 700;
	}
	.balken {
		flex: none;
		width: 4px;
		align-self: stretch;
		border-radius: 4px;
		background: var(--fill);
	}
	.balken.fremd {
		background: var(--mu);
	}
	.was {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.termin .titellink,
	.kurz .titellink {
		font-weight: 600;
	}
	.kantine {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.pdf {
		flex: none;
		width: 40px;
		height: 48px;
		border-radius: 6px;
		border: 1px solid var(--bd);
		background: var(--bg);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 6px;
		box-sizing: border-box;
		font-size: 10px;
		font-weight: 700;
		color: var(--err-tx);
	}
	.schild.zu {
		background: #fcebeb;
		color: #b42318;
	}
	/* Aktuelle Pläne: eigene Leiste */
	.plaene {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.planliste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
		gap: 12px;
	}
	.plankachel {
		display: flex;
		align-items: center;
		gap: 14px;
		height: 100%;
		box-sizing: border-box;
		padding: 12px 16px;
		color: var(--tx);
		text-decoration: none;
	}
	.plankachel:hover {
		border-color: var(--ac);
	}
	.plandatum {
		flex: none;
		width: 48px;
		height: 52px;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 700;
		line-height: 1.1;
	}
	.plandatum strong {
		font-size: 18px;
	}
	.plantitel {
		overflow-wrap: anywhere;
	}
	.leerhinweis {
		margin: 0;
		padding: 12px 16px;
		border: 2px dashed var(--bd);
		border-radius: 14px;
	}

	/* Für dich: PC Neuigkeiten links, übrige Karten rechts */
	.fuerdich {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
		gap: 16px;
		align-items: start;
	}
	.fuerdich.ohne-neues {
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
	}
	.fuerdich .neuigkeiten {
		grid-column: 1;
		grid-row: 1 / span 4;
	}
	.fuerdich:not(.ohne-neues) .seite,
	.fuerdich:not(.ohne-neues) .losgehts {
		grid-column: 2;
	}
	.fuerdich .seite.leer {
		display: none;
	}
	.nur-handy {
		display: none;
	}
	.neuschild {
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		background: var(--fill);
		border-radius: 999px;
		padding: 2px 8px;
		vertical-align: 2px;
	}
	.punkt {
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 6px;
		border-radius: 50%;
		background: var(--fill);
		vertical-align: 2px;
	}
	.aufmacher {
		position: relative;
		display: flex;
		flex-wrap: wrap;
		gap: 12px 16px;
		padding-bottom: 12px;
	}
	.aufmacherbild {
		flex: 1 1 220px;
		max-width: 280px;
		height: 150px;
		object-fit: cover;
		border-radius: 12px;
	}
	.aufmachertext {
		flex: 999 1 240px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.aufmacher h3 {
		margin: 0;
		font-size: 19px;
		line-height: 1.3;
	}
	.auszug {
		margin: 0;
		color: var(--mu);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.mitvorschau {
		flex-direction: row;
		align-items: center;
		gap: 12px;
	}
	.mini {
		flex: none;
		width: 64px;
		height: 46px;
		border-radius: 8px;
		object-fit: cover;
	}
	.mini.ohnebild {
		display: inline-grid;
		place-items: center;
		background: var(--tint);
		color: var(--ac);
	}
	.hubname {
		font-size: 12px;
		font-weight: 600;
		color: var(--ac);
	}
	.loslinks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.loslinks a {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 12px;
		border-radius: 10px;
		background: var(--bg);
		color: var(--tx);
		font-weight: 600;
		text-decoration: none;
	}

	/* Handy: Pläne zuerst, Favoriten vier je Reihe, „Für dich“ mit Bereichen */
	@media (max-width: 599px) {
		.favoritenbereich,
		.bearbeiten {
			order: 1;
		}
		.fuerdich {
			order: 2;
		}
		.planliste {
			grid-template-columns: minmax(0, 1fr);
			gap: 8px;
		}
		.plankachel {
			padding: 8px 12px;
		}
		.favoriten {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 8px;
		}
		.fav {
			min-height: 84px;
		}
		.fav-inhalt {
			padding: 10px 4px;
			gap: 6px;
		}
		.fav-symbol {
			width: 36px;
			height: 36px;
		}
		.fav-inhalt strong {
			font-size: 12px;
		}
		.fuerdich,
		.fuerdich.ohne-neues {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
			padding: 14px 12px;
			border: 1px solid var(--bd);
			border-radius: var(--radius);
			background: var(--sf);
		}
		.nur-handy {
			display: block;
		}
		.nur-pc {
			display: none;
		}
		.bereiche.nur-handy {
			display: grid;
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
			gap: 4px;
			padding: 4px;
			border-radius: 14px;
			background: var(--bg);
		}
		.bereiche button {
			position: relative;
			min-height: 56px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 4px;
			border: 0;
			border-radius: 10px;
			background: transparent;
			color: var(--mu);
			font: inherit;
			font-size: 12px;
			font-weight: 600;
			cursor: pointer;
		}
		.bereiche button[aria-selected='true'] {
			background: var(--sf);
			color: var(--ac);
			box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
		}
		.bereichssymbol {
			position: relative;
			display: flex;
		}
		.zahl {
			position: absolute;
			top: -6px;
			right: -12px;
			min-width: 16px;
			height: 16px;
			padding: 0 4px;
			box-sizing: border-box;
			border-radius: 999px;
			background: var(--fill);
			color: #fff;
			font-size: 10px;
			font-weight: 700;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.fuerdich .karte {
			border: 0;
			padding: 0;
			background: none;
			box-shadow: none;
		}
		.fuerdich .seite.leer {
			display: flex;
		}
		.fuerdich .karte.aus {
			display: none;
		}
		.fuerdich .kartenkopf h2 {
			font-size: 15px;
		}
		.aufmacherbild {
			max-width: none;
		}
	}
	.demnaechst {
		margin: 0;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--tint);
		font-size: 14px;
	}
</style>
