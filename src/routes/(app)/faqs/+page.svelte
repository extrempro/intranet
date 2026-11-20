<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve, svelte/no-at-html-tags -- Suchparameter der eigenen Seite; Antwort-HTML ist serverseitig bereinigt */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatSize } from '#lib/format.ts';

	let { data, form } = $props();
	const offen = $derived(page.url.hash.replace('#faq-', ''));
	const anzahl = $derived(data.groups.reduce((n, g) => n + g.items.length, 0));
	const neuHref = $derived(
		`${resolve('/(app)/faqs/neu')}${data.unitId ? `?einheit=${data.unitId}` : ''}`
	);
</script>

<svelte:head><title>FAQs · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>FAQs</h1>
			<form method="POST" action="?/favorit" use:enhance>
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
		{#if data.canWrite}<a class="knopf" href={neuHref}>Neue FAQ</a>{/if}
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<form method="GET" class="suche" role="search">
		<label class="feld">
			<span class="sr-only">FAQs durchsuchen</span>
			<input
				type="search"
				name="q"
				value={data.q}
				placeholder="Frage oder Stichwort suchen"
				maxlength="100"
			/>
		</label>
		{#if data.units.length > 1}
			<label class="feld">
				<span class="sr-only">Bereich</span>
				<select name="einheit" value={data.unitId ?? ''}>
					<option value="">Alle Bereiche</option>
					{#each data.units as u (u.id)}<option value={u.id}>{u.name}</option>{/each}
				</select>
			</label>
		{/if}
		<button class="knopf zweit" type="submit">Suchen</button>
	</form>

	{#if anzahl === 0}
		<p class="hinweis" role="status">
			{#if data.q || data.unitId}
				Keine FAQs zu dieser Suche gefunden. <a href="?">Alle FAQs zeigen</a>
			{:else}
				Es gibt noch keine FAQs.
			{/if}
		</p>
	{:else}
		{#if data.q}<p class="hinweis" role="status">{anzahl} Treffer</p>{/if}
		{#each data.groups as g (g.id)}
			<section class="karte gruppe" aria-labelledby="g-{g.id}">
				<h2 id="g-{g.id}">{g.name} <span class="hinweis">· {g.label}</span></h2>
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
												<form method="POST" action="?/verschieben" use:enhance>
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
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: end;
	}
	.suche .feld:first-child {
		flex: 1 1 260px;
	}
	.gruppe h2 {
		font-size: 1.1rem;
		margin: 0 0 4px;
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.fragen > li + li {
		border-top: 1px solid var(--bd);
	}
	summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::before {
		content: '›';
		flex: none;
		width: 18px;
		color: var(--ac);
		font-size: 1.3rem;
		transition: transform 0.15s ease;
	}
	details[open] > summary::before {
		transform: rotate(90deg);
	}
	@media (prefers-reduced-motion: reduce) {
		summary::before {
			transition: none;
		}
	}
	.antwort {
		display: grid;
		gap: 10px;
		padding: 0 0 14px 28px;
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
