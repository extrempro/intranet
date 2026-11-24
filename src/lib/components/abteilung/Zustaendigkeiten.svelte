<script lang="ts">
	/** „Wer hilft bei was?“ einer Abteilung: Themen mit Ansprechperson, Suche ab sechs Themen. */
	import { resolve } from '$app/paths';
	import { groupResponsibilities, matchesSearch } from '#lib/departments.ts';
	import Avatar from '../Avatar.svelte';
	import Icon from '../Icon.svelte';

	interface Zustaendigkeit {
		id: string;
		topic: string;
		description: string | null;
		keywords: string[];
		groupName: string | null;
		links: { label: string; url: string }[];
		kontakt: { id: string; name: string; phone: string | null; vertretung: boolean } | null;
	}

	let { liste, geprueftAm }: { liste: Zustaendigkeit[]; geprueftAm: Date | string | null } =
		$props();

	let suche = $state('');
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	const gefiltert = $derived(
		liste.filter((z) =>
			matchesSearch(suche, [z.topic, z.description, z.groupName, ...z.keywords, z.kontakt?.name])
		)
	);
	const gruppen = $derived(groupResponsibilities(gefiltert));
	const extern = (url: string) => !url.startsWith('/');
	const LINKSYMBOL = 'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464';
</script>

<section class="karte block" aria-labelledby="h-wer">
	<div class="blockkopf">
		<div>
			<h2 id="h-wer">Wer hilft bei was?</h2>
			{#if geprueftAm}
				<span class="unter">Zuletzt geprüft am {datum.format(new Date(geprueftAm))}</span>
			{/if}
		</div>
		{#if liste.length > 5}
			<label class="sr-only" for="zsuche">Thema suchen</label>
			<input
				id="zsuche"
				class="zsuche"
				type="search"
				bind:value={suche}
				placeholder="Thema suchen, z. B. Krankmeldung"
				autocomplete="off"
				maxlength="100"
			/>
		{/if}
	</div>
	{#if gefiltert.length === 0}
		<p class="hinweis">Kein Thema gefunden. Versuch ein anderes Wort oder die Suche oben.</p>
	{/if}
	{#each gruppen as g (g.group)}
		<div class="gruppe">
			{#if g.group}<h3>{g.group}</h3>{/if}
			<ul class="zliste">
				{#each g.items as z (z.id)}
					<li>
						<div class="thema">
							<strong>{z.topic}</strong>
							{#if z.description}<span class="unter">{z.description}</span>{/if}
							{#if z.keywords.length}
								<span class="stichworte">
									{#each z.keywords as k (k)}<span class="stichwort">{k}</span>{/each}
								</span>
							{/if}
							{#each z.links as l (l.url)}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- von der Abteilung gepflegte Adresse -->
								<a
									class="verweis"
									href={l.url}
									target={extern(l.url) ? '_blank' : undefined}
									rel={extern(l.url) ? 'noopener noreferrer' : undefined}
								>
									<Icon d={LINKSYMBOL} size={14} stroke={2} />{l.label}
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/each}
						</div>
						{#if z.kontakt}
							<div class="kontakt">
								<Avatar name={z.kontakt.name} groesse={40} />
								<span class="kontakttext">
									<a href={resolve('/(app)/personen/[id]', { id: z.kontakt.id })}>
										{z.kontakt.name}
									</a>
									<span class="unter">
										{#if z.kontakt.vertretung}Vertretung{/if}
										{#if z.kontakt.vertretung && z.kontakt.phone}&nbsp;·{/if}
										{#if z.kontakt.phone}
											<a class="tel" href="tel:{z.kontakt.phone}">{z.kontakt.phone}</a>
										{/if}
									</span>
								</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>

<style>
	.block {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.blockkopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.blockkopf > div {
		display: flex;
		flex-direction: column;
	}
	.zsuche {
		width: auto;
		min-width: 220px;
		min-height: 40px;
		background-color: var(--bg);
	}
	.gruppe h3 {
		margin: 8px 0 4px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.zliste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zliste li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
		padding: 12px 0;
		border-top: 1px solid var(--bd);
	}
	.thema {
		flex: 1 1 220px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.stichworte {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.stichwort {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--bg);
		color: var(--mu);
	}
	.verweis {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		padding: 2px 10px;
		box-sizing: border-box;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--bg);
		color: var(--ac);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.kontakt {
		flex: 1 1 260px;
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.kontakttext {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	/* Zielgröße mindestens 24 px (WCAG 2.5.8) */
	.kontakttext > a {
		font-weight: 600;
		color: var(--ac);
		overflow-wrap: anywhere;
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		min-height: 24px;
	}
	.tel {
		color: var(--mu);
		display: inline-flex;
		align-items: center;
		min-height: 24px;
	}
</style>
