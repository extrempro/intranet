<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';

	let {
		name,
		kuerzel,
		foto = null,
		mandant,
		darfVerwaltung,
		darfRedaktion = false,
		darfEntwuerfe = false,
		links = false
	}: {
		name: string;
		kuerzel: string;
		foto?: string | null;
		mandant: string;
		darfVerwaltung: boolean;
		darfRedaktion?: boolean;
		darfEntwuerfe?: boolean;
		/** Menü nach rechts aufklappen (Knopf am linken Rand, z. B. in Teams) */
		links?: boolean;
	} = $props();

	let offen = $state(false);
	let knopf: HTMLButtonElement | undefined = $state();
	let menue: HTMLDivElement | undefined = $state();

	afterNavigate(() => (offen = false));

	function schliessen(fokusZurueck = false) {
		offen = false;
		if (fokusZurueck) knopf?.focus();
	}

	function aufTaste(e: KeyboardEvent) {
		if (offen && e.key === 'Escape') schliessen(true);
	}

	function aufKlick(e: MouseEvent) {
		if (!offen) return;
		const ziel = e.target as Node;
		if (!menue?.contains(ziel) && !knopf?.contains(ziel)) schliessen();
	}
</script>

<svelte:window onkeydown={aufTaste} onclick={aufKlick} />

<div class="konto" data-tour="konto">
	<button
		bind:this={knopf}
		type="button"
		class="avatar"
		aria-expanded={offen}
		aria-controls="kontomenue"
		aria-label="{foto ? '' : `${kuerzel}: `}Kontomenü von {name}"
		onclick={() => (offen = !offen)}
	>
		{#if foto}<img src={foto} alt="" />{:else}{kuerzel}{/if}
	</button>

	{#if offen}
		<div
			bind:this={menue}
			id="kontomenue"
			class="menue"
			class:links
			role="region"
			aria-label="Kontomenü"
		>
			<div class="kopf">
				<div class="avatar gross" aria-hidden="true">
					{#if foto}<img src={foto} alt="" />{:else}{kuerzel}{/if}
				</div>
				<div><strong>{name}</strong><br /><span class="mu">{mandant}</span></div>
			</div>
			<a href={resolve('/(app)/konto')} class="eintrag">Mein Konto</a>
			{#if darfEntwuerfe}
				<a href={resolve('/(app)/entwuerfe')} class="eintrag">Meine Entwürfe</a>
			{/if}
			<a href={resolve('/(app)/handbuch')} class="eintrag">Handbuch</a>
			<a href="{resolve('/(app)')}?fuehrung=1" class="eintrag">Führung starten</a>
			<a href={resolve('/(app)/rueckmeldung/neu')} class="eintrag">Rückmeldung geben</a>
			{#if darfRedaktion}
				<a href={resolve('/(app)/redaktion')} class="eintrag">Redaktion</a>
			{/if}
			{#if darfVerwaltung}
				<a href={resolve('/(app)/verwaltung')} class="eintrag">Verwaltung</a>
			{/if}
			<form method="POST" action="/abmelden">
				<button type="submit" class="eintrag abmelden">Abmelden</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.konto {
		position: relative;
	}
	.avatar {
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--tint);
		color: var(--ac);
		font: inherit;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}
	.avatar {
		overflow: hidden;
	}
	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.avatar.gross {
		flex: none;
		cursor: default;
	}
	.menue.links {
		right: auto;
		left: 0;
	}
	.menue {
		position: absolute;
		top: 52px;
		right: 0;
		z-index: 40;
		width: 300px;
		max-width: calc(100vw - 24px);
		box-sizing: border-box;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		box-shadow: var(--shadow);
	}
	.kopf {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-bottom: 10px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--bd);
	}
	.mu {
		font-size: 13px;
		color: var(--mu);
	}
	.eintrag {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 44px;
		padding: 8px 10px;
		box-sizing: border-box;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--tx);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.eintrag:hover {
		background: var(--bg);
	}
	.abmelden {
		border-top: 1px solid var(--bd);
		border-radius: 0;
		margin-top: 4px;
	}
</style>
