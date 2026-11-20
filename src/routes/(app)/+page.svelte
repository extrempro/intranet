<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Beitragskarte from '#lib/components/Beitragskarte.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { moveItem } from '#lib/home.ts';
	import { formatWhen } from '#lib/news.ts';
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
</script>

<svelte:head><title>Start · Intranet</title></svelte:head>

<div class="start">
	<div class="kopfzeile">
		<div>
			<h1>{data.gruss}</h1>
			<p class="hinweis">{data.datum}</p>
		</div>
		{#if !bearbeiten}
			<button type="button" class="knopf zweit" onclick={starten}>Startseite anpassen</button>
		{/if}
	</div>

	{#if form?.gespeichert}<p class="meldung" role="status">Deine Startseite ist gespeichert.</p>{/if}
	{#if form?.zurueckgesetzt}<p class="meldung" role="status">
			Die Startseite ist auf den Standard zurückgesetzt.
		</p>{/if}
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<!-- Dringende Meldungen stehen immer oben (Kap. 8.2) -->
	{#each data.dringend as d (d.id)}
		<section class="banner" aria-labelledby="dr-{d.id}">
			<div>
				<h2 id="dr-{d.id}">{d.title}</h2>
				<p>{d.text}</p>
				<p class="klein">{d.sender} · dringend bis {formatWhen(d.until)}</p>
			</div>
			<div class="banner-aktionen">
				<a class="knopf zweit" href={resolve('/(app)/neuigkeiten/[id]', { id: d.id })}>
					Zum Beitrag
				</a>
				<form
					method="POST"
					action="/neuigkeiten/{d.id}?/zuklappen"
					use:enhance={() =>
						async ({ update }) =>
							update({ invalidateAll: true })}
				>
					<button class="linkknopf rot" type="submit">Gelesen, zuklappen</button>
				</form>
			</div>
		</section>
	{/each}

	<section aria-labelledby="fav-h">
		<h2 id="fav-h">Favoriten</h2>
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
								<Icon d={f.icon} />
								<strong>{f.label}</strong>
								<span class="hinweis">{f.beschreibung}</span>
							</a>
						{/if}
					</li>
				{/each}
			</ul>
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

	{#if !bearbeiten}
		{#each sichtbareKarten as k (k.id)}
			{#if k.id === 'neuigkeiten'}
				<section aria-labelledby="karte-neuigkeiten" class="stapel">
					<div class="kartenkopf">
						<h2 id="karte-neuigkeiten">Neuigkeiten</h2>
						<a href={resolve('/(app)/neuigkeiten')}>Alle Neuigkeiten</a>
					</div>
					{#if data.neuigkeiten.length === 0}
						<p class="hinweis">Gerade gibt es keine Neuigkeiten für dich.</p>
					{:else}
						{#each data.neuigkeiten as item (item.id)}<Beitragskarte
								{item}
								ebene={3}
								mitReaktionen={false}
							/>{/each}
					{/if}
				</section>
			{:else if k.id === 'termine'}
				<section aria-labelledby="karte-termine" class="stapel">
					<div class="kartenkopf">
						<h2 id="karte-termine">Heute und morgen</h2>
						<a href={resolve('/(app)/kalender')}>Zum Kalender</a>
					</div>
					{#if data.termine.items.length === 0}
						<p class="hinweis">Heute und morgen stehen keine Termine an.</p>
					{:else}
						<ul class="karte planliste">
							{#each data.termine.items as t (t.id)}
								<li>
									<a href={resolve('/(app)/kalender/[id]', { id: t.id })}>
										<strong>{t.title}</strong>
									</a>
									<span class="hinweis">
										{t.date === data.termine.today ? 'Heute' : 'Morgen'}, {timeLabel(t)}
									</span>
									<span class="voll hinweis">
										{[t.unitName, t.place].filter(Boolean).join(' · ')}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{:else if k.id === 'speiseplan'}
				<section aria-labelledby="karte-speiseplan" class="stapel">
					<div class="kartenkopf">
						<h2 id="karte-speiseplan">Speiseplan</h2>
						<a href={resolve('/(app)/speiseplan')}>Zum Speiseplan</a>
					</div>
					{#if data.kantinen.length === 0}
						<p class="hinweis">
							Wähl unter <a href={resolve('/(app)/konto/standorte')}>Meine Standorte</a> deine Kantine
							aus.
						</p>
					{:else}
						<ul class="karte planliste">
							{#each data.kantinen as kt (kt.id)}
								<li>
									<a href="{resolve('/(app)/speiseplan')}?standort={kt.id}">
										<strong>{kt.name}</strong>
									</a>
									<span class="schild" class:rand={!kt.status.open} class:zu={kt.activeClosure}>
										{kt.activeClosure ? closureTitle(kt.activeClosure) : kt.status.text}
									</span>
									{#each kt.announced as c (c.id)}
										<span class="voll hinweis">Demnächst geschlossen: {closureRange(c)}</span>
									{/each}
									<span class="voll hinweis">
										{kt.current
											? `${kt.current.title} liegt vor`
											: 'Noch kein Speiseplan für diese Woche'}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{:else if k.id === 'plaene'}
				<section aria-labelledby="karte-plaene" class="stapel">
					<div class="kartenkopf">
						<h2 id="karte-plaene">Neueste Pläne (KBB)</h2>
						<a href={resolve('/(app)/plaene')}>Alle Pläne</a>
					</div>
					{#if data.plaene.length === 0}
						<p class="hinweis">Gerade keine aktuellen Pläne deines KBB.</p>
					{:else}
						<ul class="karte planliste">
							{#each data.plaene as pl (pl.id)}
								<li>
									<a href={resolve('/(app)/plaene/[id]', { id: pl.id })}>
										<strong>{pl.title}</strong>
									</a>
									<span class="hinweis">gültig {formatRange(pl.validFrom, pl.validUntil)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.start {
		display: grid;
		gap: 18px;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0 0 10px;
	}
	.favoriten {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
		gap: 8px;
		padding: 16px;
		color: var(--tx);
		text-decoration: none;
		border-radius: var(--radius);
	}
	a.fav-inhalt:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.1);
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
	.banner {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 18px;
		border-radius: var(--radius);
		background: var(--err-bg);
		border: 2px solid var(--err-bd);
		color: var(--err-tx);
	}
	.banner h2 {
		margin: 0 0 4px;
		font-size: 1.1rem;
	}
	.banner p {
		margin: 0;
		color: var(--tx);
	}
	.banner .klein {
		font-size: 0.9rem;
		color: var(--err-tx);
		margin-top: 6px;
	}
	.banner-aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.rot {
		color: var(--err-tx);
	}
	.planliste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.planliste li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 12px 16px;
	}
	.planliste .voll {
		flex-basis: 100%;
	}
	.schild.zu {
		background: #fcebeb;
		color: #b42318;
	}
	.planliste li + li {
		border-top: 1px solid var(--bd);
	}
	.kartenkopf {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	.kartenkopf h2 {
		margin: 0;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
</style>
