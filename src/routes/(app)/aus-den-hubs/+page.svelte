<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Beitragskarte from '#lib/components/Beitragskarte.svelte';
	import { actionUrl } from '#lib/action-url.ts';

	import { livesuche } from '#lib/livesuche.ts';

	let { data, form } = $props();
	function href(o: { alle?: boolean; angeheftet?: boolean }) {
		const alle = o.alle ?? data.alle;
		const angeheftet = o.angeheftet ?? data.angeheftet;
		const teile = [
			alle ? 'ansicht=alle' : '',
			angeheftet ? 'filter=angeheftet' : '',
			data.hub ? `hub=${data.hub}` : '',
			data.q ? `q=${encodeURIComponent(data.q)}` : ''
		].filter(Boolean);
		return teile.length ? `?${teile.join('&')}` : '?';
	}
</script>

<svelte:head><title>Aus den Hubs · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Aus den Hubs</h1>
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
		{#if data.alle}<input type="hidden" name="ansicht" value="alle" />{/if}
		{#if data.angeheftet}<input type="hidden" name="filter" value="angeheftet" />{/if}
		{#if data.hub}<input type="hidden" name="hub" value={data.hub} />{/if}
		<label class="feld">
			<span class="sr-only">In den Hubs suchen</span>
			<input
				use:livesuche
				type="search"
				name="q"
				value={data.q}
				maxlength="100"
				placeholder="In den Hubs suchen …"
			/>
		</label>
	</form>

	<form method="GET" class="filter" data-sveltekit-reset="false">
		<nav class="pillen" aria-label="Ansicht">
			<a class="pille" href={href({ alle: false })} aria-current={!data.alle ? 'true' : undefined}>
				Meine Abos
			</a>
			<a class="pille" href={href({ alle: true })} aria-current={data.alle ? 'true' : undefined}>
				Alle Hubs
			</a>
			<a
				class="pille"
				href={href({ angeheftet: !data.angeheftet })}
				aria-current={data.angeheftet ? 'true' : undefined}
			>
				Angeheftet
			</a>
		</nav>
		{#if data.alle}<input type="hidden" name="ansicht" value="alle" />{/if}
		{#if data.angeheftet}<input type="hidden" name="filter" value="angeheftet" />{/if}
		{#if data.q}<input type="hidden" name="q" value={data.q} />{/if}
		{#if data.hubs.length > 1 || data.hub}
			<label>
				<span class="sr-only">Hub</span>
				<select
					name="hub"
					class="pille"
					class:an={!!data.hub}
					value={data.hub}
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				>
					<option value="">Hub: alle</option>
					{#each data.hubs as h (h.id)}<option value={h.id}>Hub: {h.name}</option>{/each}
				</select>
			</label>
		{/if}
		<noscript><button class="knopf zweit" type="submit">Anwenden</button></noscript>
		<a class="aktionslink meine" href={resolve('/(app)/konto/hubs')}>Meine Hubs ›</a>
	</form>

	{#if !data.alle && data.keineAbos}
		<div class="karte stapel leer">
			<strong>Noch keine Hubs abonniert</strong>
			<span class="hinweis">
				Tipp bei einem Hub auf die Glocke. Dann erscheinen hier seine Beiträge.
			</span>
			<a class="knopf" href={resolve('/(app)/hubs')}>Hubs ansehen</a>
		</div>
	{:else if data.items.length === 0}
		<p class="karte hinweis" role="status">
			{data.q || data.angeheftet || data.hub
				? 'Keine Beiträge zu dieser Auswahl.'
				: 'Noch keine Beiträge.'}
		</p>
	{:else}
		{#each data.items as item (item.id)}<Beitragskarte {item} mitReaktionen={false} />{/each}
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
	.meine {
		margin-left: auto;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		font-weight: 600;
	}
	.leer {
		justify-items: start;
	}
</style>
