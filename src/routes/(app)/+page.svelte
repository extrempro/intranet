<script lang="ts">
	import { enhance } from '$app/forms';
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
	// Entwurf: Neuigkeiten links, die übrigen Karten rechts untereinander
	const links = $derived(sichtbareKarten.filter((k) => k.id === 'neuigkeiten'));
	const rechts = $derived(sichtbareKarten.filter((k) => k.id !== 'neuigkeiten'));
	const WARNUNG =
		'M12 9v4M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0zM12 16h.01';
	const PIN = 'M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4M9 15l-4.5 4.5M14.5 4l5.5 5.5';
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

	<section aria-labelledby="fav-h" data-tour="favoriten">
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
							<a class="fav-inhalt" href={f.href}>
								<span class="fav-symbol"><Icon d={f.icon} size={20} stroke={1.8} /></span>
								<strong>{f.label}</strong>
								<span class="fav-text">{f.beschreibung}</span>
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
		<section class="karte" aria-labelledby="karten-h">
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
					<form
						method="POST"
						action="?/zuruecksetzen"
						use:enhance={() =>
							async ({ update }) => {
								await update();
								bearbeiten = false;
							}}
					>
						<button class="linkknopf" type="submit">Auf Standard zurücksetzen</button>
					</form>
				{/if}
			</div>
		</section>
	{/if}

	{#if !bearbeiten && sichtbareKarten.length}
		<div class="karten">
			{#each [links, rechts] as spalte, si (si)}
				{#if spalte.length}
					<div class="spalte">
						{#each spalte as k (k.id)}
							{#if k.id === 'neuigkeiten'}
								<section aria-labelledby="karte-neuigkeiten" class="karte block">
									<div class="kartenkopf">
										<h2 id="karte-neuigkeiten">Neuigkeiten</h2>
										<a class="aktionslink" href={resolve('/(app)/neuigkeiten')}>Alle anzeigen</a>
									</div>
									{#if data.neuigkeiten.length === 0}
										<p class="hinweis">Gerade gibt es keine Neuigkeiten für dich.</p>
									{:else}
										{#each data.neuigkeiten as n (n.id)}
											<article class="kurz">
												<div class="schilder">
													{#if n.pinned}<span class="schild mit-symbol">
															<Icon d={PIN} size={12} stroke={2.2} />Angeheftet
														</span>{/if}
													{#if n.urgent && n.urgentUntil}<span class="schild rot">
															Dringend bis {formatWhen(n.urgentUntil)}
														</span>{/if}
													{#if n.wasUrgent}<span class="schild rand">War dringend</span>{/if}
													{#if n.audience}<span class="schild">{n.audience}</span>{/if}
												</div>
												<h3>
													<a
														class="dehnen titellink"
														href={resolve('/(app)/neuigkeiten/[id]', { id: n.id })}
													>
														{n.title}
													</a>
												</h3>
												<span class="absender">
													<span class="kuerzel" aria-hidden="true">
														{n.sender.name.length <= 3 ? n.sender.name : n.sender.name.charAt(0)}
													</span>
													<strong>{n.sender.name}</strong>
													{n.sender.label} · {formatDay(n.publishAt)}
												</span>
											</article>
										{/each}
									{/if}
								</section>
							{:else if k.id === 'hubs'}
								<section aria-labelledby="karte-hubs" class="karte block">
									<div class="kartenkopf">
										<h2 id="karte-hubs">Neu in deinen Hubs</h2>
										<a class="aktionslink" href={resolve('/(app)/aus-den-hubs')}>Alle anzeigen</a>
									</div>
									{#if data.hubBeitraege.length === 0}
										<p class="hinweis">
											Keine neuen Beiträge. <a href={resolve('/(app)/hubs')}>Hubs ansehen</a>
										</p>
									{:else}
										<ul class="zeilen">
											{#each data.hubBeitraege as n (n.id)}
												<li class="kurz">
													<a
														class="dehnen titellink"
														href={resolve('/(app)/neuigkeiten/[id]', { id: n.id })}
													>
														{n.title}
													</a>
													<span class="meta">{n.sender.name} · {formatDay(n.publishAt)}</span>
												</li>
											{/each}
										</ul>
									{/if}
								</section>
							{:else if k.id === 'termine'}
								<section aria-labelledby="karte-termine" class="karte block">
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
													<span class="balken" class:fremd={!t.own} aria-hidden="true"></span>
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
								<section aria-labelledby="karte-speiseplan" class="karte block">
									<div class="kartenkopf">
										<h2 id="karte-speiseplan">Speiseplan</h2>
									</div>
									{#if data.kantinen.length === 0}
										<p class="hinweis">
											Wähl unter <a href={resolve('/(app)/konto/standorte')}>Meine Standorte</a> deine
											Kantine aus.
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
												<span
													class="schild"
													class:rand={!kt.status.open}
													class:zu={kt.activeClosure}
												>
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
										<a class="knopf zweit" href={resolve('/(app)/speiseplan')}>Speiseplan öffnen</a>
									{/if}
								</section>
							{:else if k.id === 'plaene'}
								<section aria-labelledby="karte-plaene" class="karte block">
									<div class="kartenkopf">
										<h2 id="karte-plaene">Neueste Pläne (KBB)</h2>
										<a class="aktionslink" href={resolve('/(app)/plaene')}>Alle</a>
									</div>
									{#if data.plaene.length === 0}
										<p class="hinweis">Gerade keine aktuellen Pläne deines KBB.</p>
									{:else}
										<ul class="zeilen">
											{#each data.plaene as pl (pl.id)}
												<li class="plan">
													<a class="dehnen" href={resolve('/(app)/plaene/[id]', { id: pl.id })}>
														{pl.title}
													</a>
													<span class="meta">{formatRange(pl.validFrom, pl.validUntil)}</span>
												</li>
											{/each}
										</ul>
									{/if}
								</section>
							{/if}
						{/each}
					</div>
				{/if}
			{/each}
		</div>
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
		background: #b42318;
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
	.favoriten {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 12px;
	}
	.fav {
		padding: 0;
		min-height: 96px;
		display: flex;
		flex-direction: column;
	}
	.fav-inhalt {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		padding: 16px;
		color: var(--tx);
		text-decoration: none;
		border-radius: var(--radius);
	}
	.fav-symbol {
		display: inline-flex;
		color: var(--ac);
		margin-bottom: 4px;
	}
	.fav-inhalt strong {
		font-weight: 600;
	}
	.fav-text {
		font-size: 13px;
		color: var(--mu);
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

	/* Karten: zwei Spalten wie im Entwurf */
	.karten {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
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
	.kurz h3 {
		margin: 0;
		font-size: 16px;
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
		background: #b42318;
		color: #fff;
	}
	.absender {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		font-size: 13px;
		color: var(--mu);
	}
	.absender strong {
		color: var(--tx);
	}
	.kuerzel {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 7px;
		background: var(--fill);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 11px;
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
	.plan {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding-top: 8px;
		margin-top: 8px;
		border-top: 1px solid var(--bd);
	}
	.plan a {
		color: var(--tx);
		font-weight: 600;
		text-decoration: none;
	}
	.plan a:hover {
		text-decoration: underline;
	}
	.plan .meta {
		white-space: nowrap;
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
		color: #b42318;
	}
	.schild.zu {
		background: #fcebeb;
		color: #b42318;
	}
	.demnaechst {
		margin: 0;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--tint);
		font-size: 14px;
	}
</style>
