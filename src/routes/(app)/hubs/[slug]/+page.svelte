<script lang="ts">
	/** Hub-Seite, Reiter „Überblick“ */
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import EinheitMediathek from '#lib/components/EinheitMediathek.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import HubBeitraege from '#lib/components/hub/HubBeitraege.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import HubDokumente from '#lib/components/hub/HubDokumente.svelte';
	import HubTermine from '#lib/components/hub/HubTermine.svelte';
	import { reiterStand } from '#lib/hub-seite.ts';
	import { LINK_SYMBOLE, type HubBlock } from '#lib/hubs.ts';

	let { data } = $props();
	const h = $derived(data.hub);
	const basis = $derived(resolve('/(app)/hubs/[slug]', { slug: h.slug }));
	const PFEIL = 'M9 6l6 6l-6 6';
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const CHAT =
		'M8 9h8M8 13h6M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z';
	const EXTERN =
		'M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6M11 13l9 -9M15 4h5v5';
	const symbol = (k: string) =>
		(LINK_SYMBOLE as Record<string, { d: string }>)[k]?.d ?? LINK_SYMBOLE.link.d;

	/** Leere Reiter, die die angemeldete Person füllen darf */
	const offen = $derived(reiterStand(data).filter((r) => r.leer && r.pflegbar));
	/** Blöcke mit Inhalt in der eingestellten Reihenfolge */
	const bloecke = $derived(
		h.layout.ueberblick.filter(
			(k): k is HubBlock =>
				(({
					schnellzugriff: h.links.length,
					termine: h.termine.length,
					faqs: h.faqs.length,
					beitraege: data.beitraege.length,
					dokumente: h.dokumente.length
				}) as Record<string, number>)[k] > 0
		)
	);
	/** Ansprechpersonen, sonst das Hub-Team (Koordination zuerst) */
	const ansprech = $derived(
		h.kontakte.length
			? h.kontakte.map((k) => ({
					id: k.personId,
					name: k.name,
					foto: k.foto,
					task: k.task,
					href: `mailto:${k.email}`,
					label: `E-Mail an ${k.name}`,
					icon: BRIEF,
					extern: false
				}))
			: h.team.slice(0, 3).map((m) => ({
					id: m.id,
					name: m.name,
					foto: m.foto,
					task: m.task,
					href: `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(m.email)}`,
					label: `Teams-Chat mit ${m.name}`,
					icon: CHAT,
					extern: true
				}))
	);
</script>

<svelte:head><title>{h.name} · Hubs · Intranet</title></svelte:head>

{#snippet block(key: HubBlock)}
	{#if key === 'schnellzugriff'}
		<section class="stapel eng" aria-labelledby="h-q">
			<h2 id="h-q">Schnellzugriff</h2>
			<ul class="kacheln">
				{#each h.links as l (l.id)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- vom Hub-Team gepflegte Adresse -->
						<a
							class="karte kachel"
							href={l.url}
							target={l.extern ? '_blank' : undefined}
							rel={l.extern ? 'noopener noreferrer' : undefined}
							title={l.description || undefined}
						>
							<span class="kachelsymbol" aria-hidden="true"><Icon d={symbol(l.icon)} /></span>
							<span class="kacheltext">
								<strong class="kacheltitel">
									{l.label}
									{#if l.extern}<span class="extern">
											<Icon d={EXTERN} size={14} stroke={2} /><span class="sr-only">
												(öffnet in neuem Fenster)
											</span>
										</span>{/if}
								</strong>
								{#if l.description}<span class="unter">{l.description}</span>{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else if key === 'termine'}
		<section class="karte" aria-labelledby="h-t">
			<div class="zeilenkopf">
				<h2 id="h-t">Als Nächstes</h2>
				<a class="klein-link" href="{basis}/termine">Alle Termine ({h.termine.length})</a>
			</div>
			<HubTermine termine={h.termine.slice(0, 2)} />
		</section>
	{:else if key === 'faqs'}
		<section class="karte" aria-labelledby="h-f">
			<div class="zeilenkopf">
				<h2 id="h-f">Häufige Fragen</h2>
				<a class="klein-link" href="{basis}/fragen">Alle Fragen ({h.faqs.length})</a>
			</div>
			<ul class="fragen">
				{#each h.faqs.slice(0, 3) as f (f.id)}
					<li>
						<a class="frage" href="{resolve('/(app)/faqs')}?einheit={h.id}#faq-{f.id}">
							<span>{f.question}</span>
							<Icon d={PFEIL} size={16} stroke={2} />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else if key === 'beitraege'}
		<section class="stapel eng" aria-labelledby="h-n">
			<div class="zeilenkopf">
				<h2 id="h-n">Neues zum Thema</h2>
				<a class="klein-link" href="{basis}/neues">Alle Beiträge</a>
			</div>
			<HubBeitraege beitraege={data.beitraege} />
		</section>
	{:else if key === 'dokumente'}
		<section class="karte" aria-labelledby="h-d">
			<div class="zeilenkopf">
				<h2 id="h-d">Dokumente</h2>
				<a class="klein-link" href="{basis}/dokumente">Alle Dokumente ({h.dokumente.length})</a>
			</div>
			<HubDokumente dokumente={h.dokumente} max={5} />
		</section>
	{/if}
{/snippet}

<div class="spalten">
	<div class="stapel">
		{#if offen.length}
			<section class="pflege" aria-labelledby="h-pflege">
				<h2 id="h-pflege">Für dich zum Pflegen</h2>
				<p>Diese Bereiche sind noch leer. Leser sehen sie erst, wenn dort etwas steht.</p>
				<ul>
					{#each offen as r (r.key)}
						<li><a href="{basis}/{r.pfad}">{r.label}</a></li>
					{/each}
				</ul>
			</section>
		{/if}
		{#each bloecke as key (key)}{@render block(key)}{/each}
		{#if !bloecke.length && !offen.length}
			<HubLeer
				titel="Hier steht noch nichts"
				text="Das Hub-Team hat für den Überblick noch keine Inhalte eingestellt."
			/>
		{/if}
	</div>
	<aside class="stapel" aria-label="Mehr zum Hub">
		{#if ansprech.length}
			<section class="karte" aria-labelledby="h-a">
				<h2 id="h-a">Fragen? Sprich uns an</h2>
				<ul class="personen">
					{#each ansprech as a (a.id)}
						<li>
							<Avatar name={a.name} foto={a.foto} groesse={40} />
							<span class="spalte">
								<a class="name" href={resolve('/(app)/personen/[id]', { id: a.id })}>{a.name}</a>
								{#if a.task}<span class="unter">{a.task}</span>{/if}
							</span>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- mailto oder Teams -->
							<a
								class="rund"
								href={a.href}
								target={a.extern ? '_blank' : undefined}
								rel={a.extern ? 'noopener noreferrer' : undefined}
								aria-label={a.label}
								title={a.label}
							>
								<Icon d={a.icon} size={18} stroke={1.8} />
							</a>
						</li>
					{/each}
				</ul>
				<a class="klein-link" href="{basis}/team">Über uns & Team</a>
			</section>
		{/if}
		<EinheitMediathek unitId={h.id} m={data.mediathek} />
	</aside>
</div>

<style>
	.spalten {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(min(280px, 100%), 1fr);
		gap: 20px;
		align-items: start;
	}
	@media (max-width: 899px) {
		.spalten {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.eng {
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.zeilenkopf {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px 10px;
	}
	.karte .zeilenkopf {
		margin-bottom: 6px;
	}
	.klein-link {
		font-size: 14px;
		font-weight: 600;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
		overflow-wrap: anywhere;
	}

	.pflege {
		padding: 16px 20px;
		border-radius: 20px;
		border: 1px dashed var(--warn-bd);
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.pflege h2 {
		font-size: 16px;
	}
	.pflege p {
		margin: 4px 0 10px;
		font-size: 14px;
	}
	.pflege ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pflege a {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--warn-bd);
		background: var(--sf);
		color: var(--warn-tx);
		font-weight: 600;
		text-decoration: none;
	}

	/* Schnellzugriff: Symbol links, Text daneben; lange Texte bleiben im Kasten */
	.kacheln {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
		gap: 10px;
	}
	.kacheln > li {
		min-width: 0;
	}
	.kachel {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		height: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: 14px;
		border-radius: 16px;
		color: var(--tx);
		text-decoration: none;
	}
	.kachel:hover {
		border-color: var(--ac);
	}
	.kachelsymbol {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--tint);
		color: var(--ac);
	}
	.kacheltext {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.kacheltitel,
	.kacheltext .unter {
		overflow-wrap: anywhere;
		hyphens: auto;
	}
	.kacheltext .unter {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.extern {
		display: inline-flex;
		vertical-align: -2px;
		margin-left: 4px;
		color: var(--mu);
	}

	.fragen,
	.personen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.fragen li,
	.personen li {
		border-top: 1px solid var(--bd);
	}
	.fragen li:first-child,
	.personen li:first-child {
		border-top: 0;
	}
	.frage {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 6px 0;
		text-decoration: none;
	}
	.personen li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
	}
	.personen + .klein-link {
		display: inline-block;
		margin-top: 8px;
	}
	.name {
		font-weight: 600;
	}
	.rund {
		width: 44px;
		height: 44px;
		flex: none;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
