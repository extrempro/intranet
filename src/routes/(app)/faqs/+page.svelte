<script lang="ts">
	import { livesuche } from '#lib/livesuche.ts';
	/* eslint-disable svelte/no-navigation-without-resolve, svelte/no-at-html-tags -- Suchparameter der eigenen Seite; Antwort-HTML ist serverseitig bereinigt */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import { actionUrl } from '#lib/action-url.ts';
	import { page } from '$app/state';
	import { formatSize } from '#lib/format.ts';

	let { data, form } = $props();
	const offen = $derived(page.url.hash.replace('#faq-', ''));
	const anzahl = $derived(data.groups.reduce((n, g) => n + g.items.length, 0));
	function filterHref(meine: boolean) {
		const teile = [
			meine ? 'filter=meine' : '',
			data.unitId ? `einheit=${data.unitId}` : '',
			data.q ? `q=${encodeURIComponent(data.q)}` : ''
		].filter(Boolean);
		return teile.length ? `?${teile.join('&')}` : '?';
	}
	const neuHref = $derived(
		`${resolve('/(app)/faqs/neu')}${data.unitId ? `?einheit=${data.unitId}` : ''}`
	);
</script>

<svelte:head><title>FAQs · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>FAQs</h1>
			<form method="POST" action={actionUrl(page.url.search, 'favorit')} use:enhance>
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
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<form
		method="GET"
		class="suche"
		role="search"
		data-sveltekit-reset="false"
		data-sveltekit-replacestate
	>
		<label class="feld">
			<span class="sr-only">FAQs durchsuchen</span>
			<input
				use:livesuche
				type="search"
				name="q"
				value={data.q}
				placeholder="Frage oder Stichwort suchen"
				maxlength="100"
			/>
		</label>
		{#if data.meine}<input type="hidden" name="filter" value="meine" />{/if}
		{#if data.unitId}<input type="hidden" name="einheit" value={data.unitId} />{/if}
	</form>

	<form method="GET" class="filter" data-sveltekit-reset="false">
		<nav class="pillen" aria-label="Filter">
			<a href={filterHref(false)} class="pille" aria-current={!data.meine ? 'true' : undefined}>
				Alle
			</a>
			<a href={filterHref(true)} class="pille" aria-current={data.meine ? 'true' : undefined}>
				Meine
			</a>
		</nav>
		{#if data.meine}<input type="hidden" name="filter" value="meine" />{/if}
		{#if data.q}<input type="hidden" name="q" value={data.q} />{/if}
		<label>
			<span class="sr-only">Von</span>
			<select
				name="einheit"
				class="pille"
				class:an={!!data.unitId}
				value={data.unitId ?? ''}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			>
				<option value="">Von: alle</option>
				{#each data.units as u (u.id)}<option value={u.id}>Von: {u.name}</option>{/each}
			</select>
		</label>
		<noscript><button class="knopf zweit" type="submit">Anwenden</button></noscript>
		{#if data.canWrite}<a class="knopf hauptaktion erstellen" href={neuHref}>FAQ erstellen</a>{/if}
	</form>

	{#if anzahl === 0}
		<p class="hinweis" role="status">
			{#if data.q || data.unitId || data.meine}
				Keine FAQs zu dieser Suche gefunden. <a href="?">Alle FAQs zeigen</a>
			{:else}
				Es gibt noch keine FAQs.
			{/if}
		</p>
	{:else}
		{#if data.q}<p class="hinweis" role="status">{anzahl} Treffer</p>{/if}
		{#each data.groups as g (g.id)}
			<section class="karte gruppe" aria-labelledby="g-{g.id}">
				<div class="gruppenkopf">
					<span class="kuerzel" aria-hidden="true">
						{g.name.length <= 3 ? g.name : g.name.charAt(0)}
					</span>
					<div class="gruppenname">
						<span class="art">{g.label}</span>
						<h2 id="g-{g.id}">{g.name}</h2>
					</div>
					<span class="anzahl">
						{g.items.length === 1 ? '1 Frage' : `${g.items.length} Fragen`}
					</span>
					<a
						class="rund"
						href={g.hub
							? resolve('/(app)/hubs/[slug]', { slug: g.slug })
							: resolve('/(app)/abteilungen/[slug]', { slug: g.slug })}
						aria-label="Zur Seite {g.name}"
						title="Zur Seite {g.name}"
					>
						<Icon d="M9 6l6 6l-6 6" size={18} stroke={2} />
					</a>
				</div>
				<ul class="fragen">
					{#each g.items as f, i (f.id)}
						<li id="faq-{f.id}">
							<details open={offen === f.id || Boolean(data.q)}>
								<summary>{f.question}</summary>
								<div class="antwort">
									<div class="text">{@html f.answerHtml}</div>
									{#if f.attachments.length}
										<ul class="anhaenge" aria-label="Anhänge">
											{#each f.attachments as a (a.id)}
												<li>
													<a
														href={resolve('/(app)/dateien/[id]', { id: a.id })}
														target="_blank"
														rel="noopener"
													>
														{a.name}
													</a>
													<span class="hinweis">{a.kind.toUpperCase()} · {formatSize(a.size)}</span>
												</li>
											{/each}
										</ul>
									{/if}
									{#if f.canEdit}
										<div class="werkzeuge">
											<a class="knopf zweit klein" href={resolve('/(app)/faqs/[id]', { id: f.id })}>
												Bearbeiten
											</a>
											{#if !data.q}
												<form
													method="POST"
													action={actionUrl(page.url.search, 'verschieben')}
													use:enhance
												>
													<input type="hidden" name="id" value={f.id} />
													<button
														class="knopf zweit klein"
														name="richtung"
														value="hoch"
														disabled={i === 0}
														aria-label="„{f.question}“ nach oben"
													>
														↑
													</button>
													<button
														class="knopf zweit klein"
														name="richtung"
														value="runter"
														disabled={i === g.items.length - 1}
														aria-label="„{f.question}“ nach unten"
													>
														↓
													</button>
												</form>
											{/if}
										</div>
									{/if}
								</div>
							</details>
						</li>
					{/each}
				</ul>
			</section>
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
	.suche {
		max-width: 560px;
	}
	.filter,
	.pillen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.erstellen {
		margin-left: auto;
	}
	.gruppe {
		padding: 0;
		border-radius: 20px;
		overflow: hidden;
	}
	.gruppenkopf {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 18px;
		background: var(--tint);
	}
	.kuerzel {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: var(--fill);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}
	.gruppenname {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.art {
		font-size: 12px;
		font-weight: 700;
		color: var(--ac);
	}
	.gruppenname h2 {
		margin: 0;
		font-size: 18px;
	}
	.anzahl {
		font-size: 13px;
		color: var(--mu);
		white-space: nowrap;
	}
	.rund {
		flex: none;
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0 18px;
	}
	.fragen > li {
		border-top: 1px solid var(--bd);
	}
	summary {
		min-height: 52px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '+';
		flex: none;
		color: var(--ac);
		font-size: 20px;
		font-weight: 400;
		line-height: 1;
	}
	details[open] > summary::after {
		content: '−';
	}
	.antwort {
		display: grid;
		gap: 10px;
		padding: 0 0 14px;
		color: var(--mu);
	}
	.text :global(p) {
		margin: 0 0 8px;
	}
	.text :global(h2),
	.text :global(h3) {
		font-size: 1.05rem;
	}
	.anhaenge {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.anhaenge li {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		align-items: center;
		min-height: 40px;
	}
	.anhaenge a {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.werkzeuge,
	.werkzeuge form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
	}
</style>
