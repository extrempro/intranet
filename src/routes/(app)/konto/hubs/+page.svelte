<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<svelte:head><title>Meine Hubs · Konto · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<h1>Meine Hubs</h1>
	<p class="hinweis">Lege je Hub fest, wie du über neue Beiträge benachrichtigt wirst.</p>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	{#if data.hubs.length === 0}
		<div class="karte stapel leer">
			<span class="hinweis">
				Du hast noch keine Hubs abonniert. Tipp bei einem Hub auf die Glocke.
			</span>
			<a class="knopf" href={resolve('/(app)/hubs')}>Hubs ansehen</a>
		</div>
	{:else}
		<ul class="liste karte">
			{#each data.hubs as h (h.id)}
				<li>
					<div class="was">
						<a href={resolve('/(app)/hubs/[slug]', { slug: h.slug })}><strong>{h.name}</strong></a>
						{#if h.mandatory}<span class="hinweis">Pflicht-Abo</span>{/if}
					</div>
					<form method="POST" action="?/kanaele" class="kanaele" use:enhance>
						<input type="hidden" name="hub" value={h.id} />
						<label><input type="checkbox" name="glocke" checked={h.bell} /> Glocke</label>
						<label><input type="checkbox" name="push" checked={h.push} /> Push</label>
						<label><input type="checkbox" name="mail" checked={h.email} /> E-Mail</label>
						<button class="knopf zweit klein" type="submit">Speichern</button>
					</form>
					{#if !h.mandatory}
						<form method="POST" action="?/abbestellen" use:enhance>
							<input type="hidden" name="hub" value={h.id} />
							<button class="linkknopf" type="submit">Abo beenden</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
		<p class="hinweis">
			E-Mails kommen sofort oder gesammelt, wie unter Konto → Benachrichtigungen eingestellt.
		</p>
	{/if}
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
	.leer {
		justify-items: start;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		padding: 12px 16px;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.was {
		flex: 1 1 200px;
		display: flex;
		flex-direction: column;
	}
	.kanaele {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.kanaele label {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
	}
	.kanaele input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
	}
</style>
