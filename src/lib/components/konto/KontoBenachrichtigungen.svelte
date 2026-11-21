<script lang="ts">
	import { page } from '$app/state';
	import { hierBleiben } from '#lib/formular.ts';
	/**
	 * Benachrichtigungen je Thema (Kap. 11) als Schalter-Pillen wie im Entwurf,
	 * dazu Push auf diesem Gerät, Ruhezeiten und E-Mail-Zusammenfassung.
	 * Auf /konto und /konto/benachrichtigungen.
	 */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Info from '#lib/components/Info.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PushGeraet from '#lib/components/PushGeraet.svelte';
	import { EMAIL_MODES, TOPICS, type EmailMode } from '#lib/notify.ts';

	interface Daten {
		einstellung: {
			topics: Record<string, { bell: boolean; push: boolean; email: boolean; teams?: boolean }>;
			emailMode: EmailMode;
			quiet: { on: boolean; start: string; end: string; weekend: boolean; urgent: boolean };
		};
		mailBereit: boolean;
		geraete: { id: string; label: string | null; createdAt: Date; lastSuccessAt: Date | null }[];
		vapidKey: string;
		teams: boolean;
		themen: string[];
	}
	let {
		daten,
		form = null,
		basis = '/konto/benachrichtigungen'
	}: { daten: Daten; form?: Record<string, unknown> | null; basis?: string } = $props();

	const e = $derived(daten.einstellung);
	const themen = $derived(TOPICS.filter((x) => daten.themen.includes(x.key)));
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	const SCHLOSS =
		'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2zM11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0M8 11v-4a4 4 0 1 1 8 0v4';
	const HAKEN = 'M5 12l5 5l10 -10';
	const ZUSATZ: Record<string, string> = {
		dringend: 'z. B. von Intendanz, Geschäftsführung, Betriebsrat oder KBB',
		angeheftet: 'Oben in Neuigkeiten und auf der Startseite',
		neuigkeiten: 'Geschäftsführung, Stabsstellen, Abteilungen'
	};
</script>

<div class="benachrichtigungen">
	{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}

	<section class="karte block" aria-labelledby="h-push">
		<h3 id="h-push">
			Push auf diesem Gerät
			<Info
				thema="Push"
				text="Push zeigt Benachrichtigungen auch an, wenn das Intranet geschlossen ist. Du schaltest Push je Gerät ein, also zum Beispiel am Handy an und am Arbeitsplatz aus. Welche Themen als Push kommen, stellst du unten ein."
			/>
		</h3>
		{#if page.data.inTeams}
			<p class="hinweis">
				In der Teams-App gibt es kein Push. Teams zeigt die Meldungen unter „Aktivität“, wenn die
				Spalte „Teams“ unten an ist. Push für Handy oder Browser schaltest du dort ein, wo du das
				Intranet außerhalb von Teams öffnest.
			</p>
		{:else}
			<PushGeraet vapidKey={daten.vapidKey} />
		{/if}
		{#if daten.geraete.length}
			<details>
				<summary>Geräte mit Push ({daten.geraete.length})</summary>
				<ul class="geraete">
					{#each daten.geraete as g (g.id)}
						<li>
							<span>
								<strong>{g.label ?? 'Gerät'}</strong>
								<span class="hinweis">
									· seit {datum.format(g.createdAt)}{g.lastSuccessAt
										? ` · zuletzt zugestellt ${datum.format(g.lastSuccessAt)}`
										: ''}
								</span>
							</span>
							<form method="POST" action="{basis}?/geraetEntfernen" use:enhance={hierBleiben}>
								<input type="hidden" name="id" value={g.id} />
								<button class="linkknopf" type="submit">Entfernen</button>
							</form>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	</section>

	<form method="POST" action="{basis}?/speichern" class="stapel" use:enhance={hierBleiben}>
		<section class="karte block" aria-labelledby="h-was">
			<h3 id="h-was">Was du bekommst</h3>
			<a class="handbuch" href={resolve('/(app)/handbuch/[slug]', { slug: 'benachrichtigungen' })}>
				Handbuch: Benachrichtigungen
			</a>
			<p class="hinweis">
				Wähle pro Thema, wie du informiert werden möchtest. Die Voreinstellungen sind bewusst
				sparsam.
			</p>
			<ul class="matrix">
				{#each themen as t (t.key)}
					<li>
						<span class="thema">
							<strong id="t-{t.key}">{t.label}</strong>
							{#if ZUSATZ[t.key] || t.hint}<span class="hinweis">
									{ZUSATZ[t.key] ?? t.hint}
								</span>{/if}
						</span>
						<span class="schalter" role="group" aria-labelledby="t-{t.key}">
							{#each [{ k: 'bell', n: 'glocke', l: 'Glocke' }, { k: 'push', n: 'push', l: 'Push' }, { k: 'email', n: 'mail', l: 'E-Mail' }] as c (c.k)}
								{@const fest = t.fixed?.includes(c.k as 'bell' | 'push')}
								<label class="umschalter" class:fest>
									<input
										class="sr-only"
										type="checkbox"
										name="{t.key}_{c.n}"
										checked={e.topics[t.key][c.k as 'bell' | 'push' | 'email']}
										disabled={fest}
									/>
									{#if fest}<input type="hidden" name="{t.key}_{c.n}" value="on" />{/if}
									<span class="an-symbol" aria-hidden="true">
										<Icon d={fest ? SCHLOSS : HAKEN} size={13} stroke={2.4} />
									</span>
									{c.l}{#if fest}<span class="sr-only"> (immer an)</span>{/if}
								</label>
							{/each}
							{#if daten.teams}
								<label class="umschalter">
									<input
										class="sr-only"
										type="checkbox"
										name="{t.key}_teams"
										checked={e.topics[t.key].teams}
									/>
									<span class="an-symbol" aria-hidden="true">
										<Icon d={HAKEN} size={13} stroke={2.4} />
									</span>
									Teams
								</label>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
			<p class="hinweis klein">
				Schloss: bei dringenden Meldungen immer an. Push kommt nur auf Geräten an, auf denen du ihn
				oben eingeschaltet hast. Hubs stellst du unter
				<a href={resolve('/(app)/konto/hubs')}>Meine Hubs</a> ein.
				{#if daten.teams}Teams-Meldungen erscheinen in Teams unter „Aktivität“; ein Klick öffnet den
					Beitrag direkt in der Intranet-App in Teams.{/if}
			</p>
		</section>

		<div class="zwei">
			<fieldset class="karte block">
				<legend>
					Ruhezeiten
					<Info
						thema="Ruhezeiten"
						text="Die Zeiten gelten in deutscher Zeit, auch wenn dein Gerät anders eingestellt ist. Über Mitternacht geht, zum Beispiel 20 bis 7 Uhr. Dringende Meldungen kommen trotzdem sofort, wenn du das unten nicht ausschaltest."
					/>
				</legend>
				<label class="option-schalter">
					<span>Ruhezeiten einhalten</span>
					<input type="checkbox" role="switch" class="schalter" name="ruhe" checked={e.quiet.on} />
				</label>
				<p class="hinweis klein">Kein Push und keine Teams-Nachricht in dieser Zeit.</p>
				<div class="zeiten">
					<label class="feld">
						<span>Von</span>
						<input type="time" name="ruhe_von" value={e.quiet.start} required />
					</label>
					<label class="feld">
						<span>Bis</span>
						<input type="time" name="ruhe_bis" value={e.quiet.end} required />
					</label>
				</div>
				<label class="option">
					<input type="checkbox" name="ruhe_wochenende" checked={e.quiet.weekend} />
					<span>Am Wochenende auch</span>
				</label>
				<label class="option-schalter trenner">
					<span>Dringende Meldungen trotzdem sofort</span>
					<input
						type="checkbox"
						role="switch"
						class="schalter"
						name="ruhe_dringend"
						checked={e.quiet.urgent}
					/>
				</label>
			</fieldset>

			<fieldset class="karte block">
				<legend>
					E-Mail-Zusammenfassung
					<Info
						thema="E-Mail-Zusammenfassung"
						text="Die Zusammenfassung enthält alle Themen, bei denen du E-Mail gewählt hast. Dringende Meldungen kommen immer sofort."
					/>
				</legend>
				<div class="pillen">
					{#each EMAIL_MODES as m (m.key)}
						<label class="pille" class:an={e.emailMode === m.key} title={m.hint}>
							<input
								class="sr-only"
								type="radio"
								name="modus"
								value={m.key}
								checked={e.emailMode === m.key}
							/>
							{m.label}
						</label>
					{/each}
				</div>
				<p class="hinweis klein">
					{EMAIL_MODES.find((m) => m.key === e.emailMode)?.hint}
				</p>
				{#if !daten.mailBereit}
					<p class="hinweis klein">
						Der E-Mail-Versand ist noch nicht eingerichtet. Deine Auswahl gilt, sobald er läuft.
					</p>
				{/if}
			</fieldset>
		</div>

		<div><button class="knopf" type="submit">Speichern</button></div>
	</form>
</div>

<style>
	.option-schalter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 44px;
		font-weight: 600;
	}
	.option-schalter.trenner {
		margin-top: 6px;
		padding-top: 8px;
		border-top: 1px solid var(--bd);
	}
	.benachrichtigungen {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
	}
	h3,
	legend {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	fieldset legend {
		float: left;
		width: 100%;
		padding: 0;
	}
	.handbuch {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.matrix {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.matrix li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.thema {
		flex: 1 1 200px;
		display: flex;
		flex-direction: column;
	}
	.thema .hinweis {
		font-size: 13px;
	}
	.schalter {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.umschalter {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 76px;
		min-height: 36px;
		padding: 4px 10px;
		box-sizing: border-box;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}
	.an-symbol {
		display: none;
	}
	.umschalter:has(input:checked) {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
		font-weight: 600;
	}
	.umschalter:has(input:checked) .an-symbol,
	.umschalter.fest .an-symbol {
		display: inline-flex;
	}
	.umschalter.fest {
		background: var(--bg);
		border-color: var(--bd);
		color: var(--mu);
		cursor: default;
	}
	.umschalter:has(input:focus-visible),
	.pille:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.klein {
		font-size: 13px;
	}
	.zwei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 16px;
		align-items: start;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.zeiten {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 12px;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pille:has(input:checked) {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
		font-weight: 600;
	}
	.geraete {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: grid;
	}
	.geraete li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 4px 12px;
		padding: 6px 0;
		border-top: 1px solid var(--bd);
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
	}
</style>
