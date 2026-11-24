<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { ROLLEN } from '#lib/tours.ts';

	let { data, form } = $props();
	const l = $derived(data.liste);
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	const zuPruefen = $derived(
		l.zuPruefen.ueberfaellig.length +
			l.zuPruefen.ablaufend.length +
			l.zuPruefen.alteFaqs.length +
			l.zuPruefen.inaktiv.length
	);
	const abschnitte = $derived(
		[
			l.redaktion && { id: 'ohne-pflege', label: 'Ohne Pflege', n: l.ohnePflege.length },
			l.redaktion && { id: 'zu-pruefen', label: 'Zu prüfen', n: zuPruefen },
			l.redaktion && {
				id: 'hervorgehoben',
				label: 'Dringend und angeheftet',
				n: l.hervorgehoben.length
			},
			l.redaktion && { id: 'antraege', label: 'Hub-Anträge vorprüfen', n: l.antraege.length },
			l.themen && { id: 'themen', label: 'Themen-Vorschläge', n: l.themen.length },
			l.moderation && { id: 'brett', label: 'Schwarzes Brett prüfen', n: l.brett.length }
		].filter(Boolean) as { id: string; label: string; n: number }[]
	);
</script>

<svelte:head><title>Redaktion · Intranet</title></svelte:head>

<div class="stapel">
	{#if l.redaktion}
		<EinfuehrungAngebot
			tour={ROLLEN.redaktion}
			text="Neu in der Redaktion? Eine kurze Einführung zeigt dir die Arbeitsliste."
		/>
	{/if}
	<div>
		<h1 class="mit-hilfe">
			Redaktion
			{#if l.redaktion}<EinfuehrungKnopf tour={ROLLEN.redaktion} />{/if}
		</h1>
		<p class="hinweis">
			Arbeitsliste{l.mandanten.length
				? ` für ${l.mandanten.join(', ')} und zentrale Einheiten`
				: ''}. Einträge verschwinden, sobald sie erledigt sind.
		</p>
	</div>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.ok}<p class="meldung" role="status">{form.ok}</p>{/if}

	<nav class="zaehler" aria-label="Abschnitte" data-tour="zaehler">
		{#each abschnitte as a (a.id)}
			<a class="karte kachel" href="#{a.id}">
				<span class="zahl" class:null={a.n === 0}>{a.n}</span>
				<span>{a.label}</span>
			</a>
		{/each}
	</nav>

	{#if l.redaktion}
		<section id="ohne-pflege" data-tour="ohne-pflege" class="karte stapel" aria-labelledby="h-ohne">
			<h2 id="h-ohne">Ohne Pflege</h2>
			<p class="hinweis">
				Einheiten ohne eigene Pflegeperson pflegt die Redaktion: die Seite und dazu Beiträge, FAQs
				und Termine. Einheiten mit eigener Pflege bearbeitet die Redaktion nicht.
			</p>
			{#if l.ohnePflege.length === 0}<p class="hinweis">Alles hat eine Pflege.</p>{/if}
			<ul class="liste">
				{#each l.ohnePflege as u (u.id)}
					<li>
						<span>
							<strong>{u.name}</strong> <span class="hinweis">· {u.label} · {u.tenantShort}</span>
						</span>
						{#if u.type === 'hub'}
							<a href={resolve('/(app)/hubs/[slug]/bearbeiten', { slug: u.slug })}>Bearbeiten</a>
						{:else}
							<a href={resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: u.slug })}>
								Bearbeiten
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section
			id="zu-pruefen"
			data-tour="zu-pruefen"
			class="karte stapel"
			aria-labelledby="h-pruefen"
		>
			<h2 id="h-pruefen">Zu prüfen</h2>
			{#if zuPruefen === 0}<p class="hinweis">Nichts zu prüfen.</p>{/if}
			{#if l.zuPruefen.ueberfaellig.length}
				<h3>Überfällige Zuständigkeiten</h3>
				<ul class="liste">
					{#each l.zuPruefen.ueberfaellig as u (u.id)}
						<li>
							<a href={resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: u.slug })}>
								{u.name}
							</a>
							<span class="hinweis">zuletzt geprüft am {datum.format(u.checkedAt!)}</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if l.zuPruefen.ablaufend.length}
				<h3>Bald ablaufende Beiträge</h3>
				<ul class="liste">
					{#each l.zuPruefen.ablaufend as n (n.id)}
						<li>
							<a href={resolve('/(app)/neuigkeiten/[id]', { id: n.id })}>{n.title}</a>
							<span class="hinweis">{n.unitName} · läuft ab am {datum.format(n.expiresAt!)}</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if l.zuPruefen.alteFaqs.length}
				<h3>Lange nicht geänderte FAQs</h3>
				<ul class="liste">
					{#each l.zuPruefen.alteFaqs as f (f.id)}
						<li>
							<a href="{resolve('/(app)/faqs')}#faq-{f.id}">{f.question}</a>
							<span class="hinweis">{f.unitName} · zuletzt {datum.format(f.updatedAt)}</span>
							<form method="POST" action="?/faqAktuell" use:enhance>
								<input type="hidden" name="id" value={f.id} />
								<button
									class="knopf zweit klein"
									type="submit"
									aria-label="„{f.question}“ ist noch aktuell"
								>
									Noch aktuell
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			{#if l.zuPruefen.inaktiv.length}
				<h3>Inaktive Ansprechpersonen</h3>
				<ul class="liste">
					{#each l.zuPruefen.inaktiv as x (x.personId + x.unitId)}
						<li>
							<span><strong>{x.name}</strong> <span class="hinweis">· {x.unitName}</span></span>
							{#if x.type === 'hub'}
								<a href={resolve('/(app)/hubs/[slug]', { slug: x.slug })}>Zum Hub</a>
							{:else}
								<a href={resolve('/(app)/abteilungen/[slug]', { slug: x.slug })}>Zur Seite</a>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section id="hervorgehoben" class="karte stapel" aria-labelledby="h-hervor">
			<h2 id="h-hervor">Dringend und angeheftet</h2>
			<p class="hinweis">
				Du kannst das Anheften lösen, „Dringend“ beenden oder einen Beitrag sofort ablaufen lassen.
				Das Protokoll hält fest, wer eingegriffen hat.
			</p>
			{#if l.hervorgehoben.length === 0}<p class="hinweis">
					Gerade nichts dringend oder angeheftet.
				</p>{/if}
			<ul class="liste">
				{#each l.hervorgehoben as n (n.id)}
					<li>
						<span>
							{#if n.urgentUntil && n.urgentUntil > new Date()}<span class="schild dringend">
									Dringend
								</span>{/if}
							{#if n.pinnedUntil && n.pinnedUntil > new Date()}<span class="schild">
									Angeheftet{n.byEditorial ? ' (Redaktion)' : ''}
								</span>{/if}
							<a href={resolve('/(app)/neuigkeiten/[id]', { id: n.id })}>{n.title}</a>
						</span>
						<span class="hinweis">
							{n.unitName} · bis {datum.format(
								n.urgentUntil && n.urgentUntil > new Date() ? n.urgentUntil : n.pinnedUntil!
							)}
						</span>
						{#if n.eingreifen}<span class="eingriffe">
								{#if n.pinnedUntil && n.pinnedUntil > new Date()}
									<MitFrage
										action="?/beitrag"
										knopf="Anheften lösen"
										knopfKlasse="knopf zweit klein"
										frage={{
											titel: 'Anheften lösen?',
											text: `„${n.title}“ bleibt sichtbar, steht aber nicht mehr oben.`,
											ja: 'Lösen'
										}}
									>
										{#snippet felder()}<input type="hidden" name="id" value={n.id} /><input
												type="hidden"
												name="art"
												value="loesen"
											/>{/snippet}
									</MitFrage>
								{/if}
								{#if n.urgentUntil && n.urgentUntil > new Date()}
									<MitFrage
										action="?/beitrag"
										knopf="Dringend beenden"
										knopfKlasse="knopf zweit klein"
										frage={{
											titel: 'Dringende Meldung beenden?',
											text: `Das Banner zu „${n.title}“ verschwindet sofort. Der Beitrag bleibt als normale Neuigkeit.`,
											ja: 'Beenden'
										}}
									>
										{#snippet felder()}<input type="hidden" name="id" value={n.id} /><input
												type="hidden"
												name="art"
												value="dringend"
											/>{/snippet}
									</MitFrage>
								{/if}
								<MitFrage
									action="?/beitrag"
									knopf="Beitrag beenden"
									knopfKlasse="knopf zweit klein"
									frage={{
										titel: 'Beitrag jetzt beenden?',
										text: `„${n.title}“ läuft sofort ab und ist danach für niemanden mehr sichtbar.`,
										ja: 'Beenden',
										gefahr: true
									}}
								>
									{#snippet felder()}<input type="hidden" name="id" value={n.id} /><input
											type="hidden"
											name="art"
											value="beenden"
										/>{/snippet}
								</MitFrage>
							</span>{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section id="antraege" class="karte stapel" aria-labelledby="h-antraege">
			<h2 id="h-antraege">Hub-Anträge vorprüfen</h2>
			{#if l.antraege.length === 0}<p class="hinweis">Keine neuen Anträge.</p>{/if}
			<ul class="liste">
				{#each l.antraege as a (a.id)}
					<li>
						<strong>{a.name}</strong>
						<span class="hinweis">eingegangen am {datum.format(a.createdAt)}</span>
					</li>
				{/each}
			</ul>
			{#if l.antraege.length}<a href={resolve('/(app)/hubs/antraege')}>Zu den Anträgen</a>{/if}
		</section>

		{#if l.themen}
			<section id="themen" class="karte stapel" aria-labelledby="h-themen">
				<h2 id="h-themen">Themen-Vorschläge</h2>
				<p class="hinweis">
					{l.themen.length
						? `${l.themen.length === 1 ? 'Ein Vorschlag wartet' : `${l.themen.length} Vorschläge warten`} auf deine Entscheidung.`
						: 'Gerade keine Vorschläge.'}
					Die Themen gelten für Videos und FAQs in allen Mandanten.
				</p>
				<p><a href={resolve('/(app)/redaktion/themen')}>Themen pflegen</a></p>
			</section>
		{/if}
	{/if}

	{#if l.moderation}
		<section id="brett" class="karte stapel" aria-labelledby="h-brett">
			<h2 id="h-brett">Schwarzes Brett prüfen</h2>
			{#if l.brett.length === 0}<p class="hinweis">Nichts zu prüfen.</p>{/if}
			<ul class="liste">
				{#each l.brett as a (a.id)}
					<li>
						<span>
							<span class="schild" class:dringend={a.gemeldet}>
								{a.gemeldet ? 'Gemeldet' : 'Neu'}
							</span>
							{a.title}
						</span>
						<span class="hinweis">{a.tenantShort}</span>
					</li>
				{/each}
			</ul>
			{#if l.brett.length}<a href="{resolve('/(app)/schwarzes-brett')}?ansicht=moderation">
					Zur Moderation
				</a>{/if}
		</section>
	{/if}
</div>

<style>
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.15rem;
	}
	h3 {
		font-size: 1rem;
		margin-top: 6px;
	}
	.zaehler {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
		gap: 10px;
	}
	.kachel {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--tx);
		text-decoration: none;
	}
	.kachel:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.1);
	}
	.zahl {
		font-size: 1.8rem;
		font-weight: 800;
		color: var(--ac);
	}
	.zahl.null {
		color: var(--mu);
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.liste li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
	}
	.eingriffe {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex-basis: 100%;
	}
	.schild.dringend {
		background: #fcebeb;
		color: #b42318;
	}
	section {
		scroll-margin-top: 80px;
	}
</style>
