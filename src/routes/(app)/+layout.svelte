<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Ziele kommen aus dem festen Register in nav.ts, kein Base-Pfad */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import Kontomenue from '#lib/components/Kontomenue.svelte';
	import { currentNav, navAreas } from '#lib/nav.ts';

	let { data, children } = $props();

	const areas = navAreas();
	const aktuell = $derived(currentNav(areas, page.url.pathname));
	const seitentitel = $derived(aktuell.page?.label ?? aktuell.area?.label ?? 'Intranet');
	let wechselnOffen = $state(false);

	let theme = $derived(data.theme);

	/** Wirksame Darstellung: bei „auto“ entscheidet das System. */
	function istDunkel(t: string): boolean {
		if (t === 'dunkel') return true;
		if (t === 'hell') return false;
		return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
	}

	const SONNE =
		'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0 -8M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7';
	const MOND = 'M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z';
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const GLOCKE =
		'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1';
	const dunkel = $derived(istDunkel(theme));
</script>

<a class="skip" href="#inhalt">Zum Inhalt springen</a>

<div class="app akzent" style={data.akzent}>
	<header class="kopf">
		<a class="marke" href={resolve('/(app)')} aria-label="Intranet, zur Startseite">
			<span class="logo" aria-hidden="true">{data.ich.mandantKurz}</span>
			<span class="name nur-gross">Intranet</span>
		</a>
		<span class="titel nur-handy" aria-hidden="true">{seitentitel}</span>
		<span class="luecke"></span>

		<form
			method="POST"
			action="/konto/darstellung?/umschalten"
			use:enhance={({ formData }) => {
				const neu = dunkel ? 'hell' : 'dunkel';
				formData.set('wert', neu);
				theme = neu;
				document.documentElement.dataset.theme = neu;
				return async () => {};
			}}
		>
			<button
				type="submit"
				class="symbolknopf"
				aria-label={dunkel ? 'Helle Darstellung' : 'Dunkle Darstellung'}
				title={dunkel ? 'Helle Darstellung' : 'Dunkle Darstellung'}
			>
				<Icon d={dunkel ? SONNE : MOND} size={20} stroke={1.8} />
			</button>
		</form>

		<a
			class="symbolknopf glocke"
			href={resolve('/(app)/nachrichten')}
			aria-label={data.nachrichten
				? `Nachrichten, ${data.nachrichten} mit neuen Antworten`
				: 'Nachrichten'}
			title="Nachrichten"
			aria-current={page.url.pathname.startsWith('/nachrichten') ? 'page' : undefined}
		>
			<Icon d={BRIEF} size={20} stroke={1.8} />
			{#if data.nachrichten}<span class="zaehler" aria-hidden="true">
					{data.nachrichten > 99 ? '99+' : data.nachrichten}
				</span>{/if}
		</a>

		<a
			class="symbolknopf glocke"
			href={resolve('/(app)/benachrichtigungen')}
			aria-label={data.ungelesen
				? `Benachrichtigungen, ${data.ungelesen} ungelesen`
				: 'Benachrichtigungen'}
			title="Benachrichtigungen"
			aria-current={page.url.pathname === '/benachrichtigungen' ? 'page' : undefined}
		>
			<Icon d={GLOCKE} size={20} stroke={1.8} />
			{#if data.ungelesen}<span class="zaehler" aria-hidden="true">
					{data.ungelesen > 99 ? '99+' : data.ungelesen}
				</span>{/if}
		</a>

		<Kontomenue
			name={data.ich.name}
			kuerzel={data.ich.kuerzel}
			foto={data.ich.foto}
			mandant={data.ich.mandant}
			darfVerwaltung={data.darfVerwaltung}
			darfRedaktion={data.darfRedaktion}
		/>
	</header>

	<div class="rumpf">
		<!-- PC: Seitenleiste mit Bereichen und Unterseiten -->
		<nav class="seitenleiste" aria-label="Hauptnavigation">
			<ul>
				{#each areas as area (area.key)}
					{@const an = aktuell.area?.key === area.key}
					<li>
						<a
							class="pille"
							class:an
							href={area.href}
							aria-current={an && !aktuell.page ? 'page' : undefined}
						>
							<Icon d={area.icon} />
							<span>{area.label}</span>
						</a>
						{#if an && area.pages.length > 1}
							<ul class="unter">
								{#each area.pages as p (p.key)}
									<li>
										<a
											href={p.href}
											class:an={aktuell.page?.key === p.key}
											aria-current={aktuell.page?.key === p.key ? 'page' : undefined}
										>
											{p.label}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		</nav>

		<!-- Tablet: schmale Leiste mit Bereichen -->
		<nav class="leiste" aria-label="Hauptnavigation">
			{#each areas as area (area.key)}
				{@const an = aktuell.area?.key === area.key}
				<a href={area.href} class:an aria-current={an ? 'page' : undefined}>
					<Icon d={area.icon} />
					<span>{area.label}</span>
				</a>
			{/each}
		</nav>

		<div class="spalte">
			{#if aktuell.area && aktuell.area.pages.length > 1}
				<!-- Tablet: Unterseiten als Reiter -->
				<nav class="reiter" aria-label="Unterseiten von {aktuell.area.label}">
					{#each aktuell.area.pages as p (p.key)}
						<a
							href={p.href}
							class:an={aktuell.page?.key === p.key}
							aria-current={aktuell.page?.key === p.key ? 'page' : undefined}
						>
							{p.label}
						</a>
					{/each}
				</nav>
				<!-- Handy: Unterseite wechseln -->
				<div class="wechseln">
					<button
						type="button"
						class="knopf zweit"
						aria-expanded={wechselnOffen}
						aria-controls="unterseiten"
						onclick={() => (wechselnOffen = !wechselnOffen)}
					>
						{aktuell.area.label} · {aktuell.page?.label ?? ''} – Wechseln
					</button>
					{#if wechselnOffen}
						<ul id="unterseiten" class="blatt">
							{#each aktuell.area.pages as p (p.key)}
								<li>
									<a
										href={p.href}
										aria-current={aktuell.page?.key === p.key ? 'page' : undefined}
										onclick={() => (wechselnOffen = false)}
									>
										{p.label}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			<main id="inhalt" tabindex="-1">
				{@render children()}
			</main>
		</div>
	</div>

	<!-- Handy: Leiste unten -->
	<nav class="unten" aria-label="Hauptnavigation">
		{#each areas as area (area.key)}
			{@const an = aktuell.area?.key === area.key}
			<a href={area.href} class:an aria-current={an ? 'page' : undefined}>
				<Icon d={area.icon} />
				<span>{area.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* ---- Kopfzeile ---- */
	.kopf {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: max(8px, env(safe-area-inset-top)) 12px 8px;
		background: var(--sf);
		border-bottom: 1px solid var(--bd);
	}
	.marke {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--tx);
		text-decoration: none;
		min-height: 44px;
	}
	.logo {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--fill);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 13px;
	}
	.name {
		font-weight: 700;
		font-size: 17px;
	}
	.titel {
		font-weight: 700;
		font-size: 17px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.luecke {
		flex: 1;
	}
	.symbolknopf {
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--tx);
		border: 1px solid var(--bd);
		border-radius: 10px;
		cursor: pointer;
		padding: 0;
	}

	.glocke {
		position: relative;
		text-decoration: none;
	}
	.zaehler {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		box-sizing: border-box;
		border-radius: 999px;
		background: #b42318;
		color: #fff;
		font-size: 12px;
		font-weight: 700;
		line-height: 20px;
		text-align: center;
	}

	/* ---- Rumpf ---- */
	.rumpf {
		display: flex;
		flex: 1;
		min-width: 0;
	}
	.spalte {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	main {
		width: 100%;
		max-width: 1120px;
		box-sizing: border-box;
		margin: 0 auto;
		padding: 24px 24px 48px;
	}
	main:focus {
		outline: none;
	}

	/* PC-Seitenleiste: „schwebende Pillen“ */
	.seitenleiste {
		display: none;
		flex: 0 0 260px;
		box-sizing: border-box;
		background: var(--sf);
		border-right: 1px solid var(--bd);
	}
	.seitenleiste > ul {
		position: sticky;
		top: 61px;
		list-style: none;
		margin: 0;
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.pille {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 48px;
		padding: 11px 14px;
		box-sizing: border-box;
		border-radius: 999px;
		color: var(--tx);
		text-decoration: none;
		font-size: 15px;
	}
	.pille:hover {
		background: var(--bg);
	}
	.pille.an {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}
	.unter {
		list-style: none;
		margin: 2px 0 8px 25px;
		padding-left: 12px;
		border-left: 1px solid var(--bd);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.unter a {
		display: flex;
		align-items: center;
		min-height: 40px;
		padding: 6px 12px;
		border-radius: 999px;
		color: var(--tx);
		text-decoration: none;
		font-size: 14px;
	}
	.unter a.an {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}

	/* Tablet-Leiste */
	.leiste {
		display: none;
		flex: 0 0 88px;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 16px 6px;
		box-sizing: border-box;
		background: var(--sf);
		border-right: 1px solid var(--bd);
	}
	.leiste a,
	.unten a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 4px;
		min-height: 52px;
		box-sizing: border-box;
		width: 100%;
		border-radius: 14px;
		color: var(--tx);
		text-decoration: none;
		font-size: 12px;
		font-weight: 600;
	}
	.leiste a.an :global(svg),
	.unten a.an :global(svg) {
		background: var(--tint);
		color: var(--ac);
		border-radius: 999px;
		padding: 4px 14px;
	}
	.leiste a.an,
	.unten a.an {
		color: var(--ac);
	}

	.reiter {
		display: none;
		gap: 4px;
		padding: 12px 24px 0;
		overflow-x: auto;
	}
	.reiter a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 999px;
		color: var(--tx);
		text-decoration: none;
		white-space: nowrap;
	}
	.reiter a.an {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}

	.wechseln {
		display: none;
		padding: 12px 14px 0;
	}
	.blatt {
		list-style: none;
		margin: 8px 0 0;
		padding: 8px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		box-shadow: var(--shadow);
	}
	.blatt a {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 12px;
		color: var(--tx);
		text-decoration: none;
		border-radius: 10px;
	}
	.blatt a[aria-current='page'] {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}

	/* Handy-Leiste unten */
	.unten {
		display: none;
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		padding: 6px 8px max(6px, env(safe-area-inset-bottom));
		background: var(--sf);
		border-top: 1px solid var(--bd);
		justify-content: space-around;
	}
	.unten a {
		flex: 1;
		max-width: 120px;
	}

	.nur-handy {
		display: none;
	}

	/* ---- Geräte ---- */
	@media (min-width: 1024px) {
		.seitenleiste {
			display: block;
		}
	}
	@media (min-width: 600px) and (max-width: 1023px) {
		.leiste {
			display: flex;
		}
		.reiter {
			display: flex;
		}
	}
	@media (max-width: 599px) {
		.unten {
			display: flex;
		}
		.wechseln {
			display: block;
		}
		.nur-gross {
			display: none;
		}
		.nur-handy {
			display: block;
		}
		.kopf {
			padding-left: 8px;
			padding-right: 8px;
		}
		main {
			padding: 16px 14px 110px;
		}
	}
</style>
