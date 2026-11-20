<script lang="ts">
	/**
	 * Web Push auf diesem Gerät ein- oder ausschalten (Kap. 11.1). Auf dem
	 * iPhone geht Push erst, wenn das Intranet zum Home-Bildschirm hinzugefügt ist.
	 */
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	let { vapidKey }: { vapidKey: string } = $props();

	type Zustand = 'pruefen' | 'nicht-moeglich' | 'iphone' | 'blockiert' | 'aus' | 'an';
	let zustand = $state<Zustand>('pruefen');
	let arbeitet = $state(false);
	let fehler = $state('');

	function schluessel(b64: string): Uint8Array<ArrayBuffer> {
		const pad = '='.repeat((4 - (b64.length % 4)) % 4);
		const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
		const out = new Uint8Array(new ArrayBuffer(raw.length));
		for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
		return out;
	}

	async function registrierung() {
		return navigator.serviceWorker.ready;
	}

	onMount(async () => {
		const ios = /iPhone|iPad/.test(navigator.userAgent);
		const installiert =
			matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			zustand = ios && !installiert ? 'iphone' : 'nicht-moeglich';
			return;
		}
		if (Notification.permission === 'denied') {
			zustand = 'blockiert';
			return;
		}
		const abo = await (await registrierung()).pushManager.getSubscription();
		zustand = abo ? 'an' : 'aus';
	});

	async function senden(method: 'POST' | 'DELETE', abo: PushSubscription) {
		const res = await fetch('/push/abo', {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(abo.toJSON())
		});
		if (!res.ok) throw new Error((await res.text()) || 'Fehler');
	}

	async function einschalten() {
		arbeitet = true;
		fehler = '';
		try {
			const erlaubnis = await Notification.requestPermission();
			if (erlaubnis !== 'granted') {
				zustand = erlaubnis === 'denied' ? 'blockiert' : 'aus';
				return;
			}
			const reg = await registrierung();
			const abo =
				(await reg.pushManager.getSubscription()) ??
				(await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: schluessel(vapidKey)
				}));
			await senden('POST', abo);
			zustand = 'an';
			await invalidateAll();
		} catch {
			fehler = 'Push ließ sich nicht einschalten. Versuch es später noch einmal.';
		} finally {
			arbeitet = false;
		}
	}

	async function ausschalten() {
		arbeitet = true;
		fehler = '';
		try {
			const abo = await (await registrierung()).pushManager.getSubscription();
			if (abo) {
				await senden('DELETE', abo).catch(() => {});
				await abo.unsubscribe();
			}
			zustand = 'aus';
			await invalidateAll();
		} finally {
			arbeitet = false;
		}
	}
</script>

<div class="stapel" aria-live="polite">
	{#if zustand === 'pruefen'}
		<p class="hinweis">Prüfe dieses Gerät …</p>
	{:else if zustand === 'iphone'}
		<p class="hinweis">
			Auf dem iPhone und iPad gehen Push-Nachrichten erst, wenn du das Intranet zum Home-Bildschirm
			hinzufügst: in Safari auf „Teilen“ tippen, dann „Zum Home-Bildschirm“. Öffne das Intranet
			danach über das neue Symbol.
		</p>
	{:else if zustand === 'nicht-moeglich'}
		<p class="hinweis">Dieser Browser unterstützt keine Push-Nachrichten.</p>
	{:else if zustand === 'blockiert'}
		<p class="hinweis">
			Benachrichtigungen sind für das Intranet in diesem Browser blockiert. Du kannst sie in den
			Website-Einstellungen des Browsers wieder erlauben.
		</p>
	{:else if zustand === 'an'}
		<p><strong>Push ist auf diesem Gerät an.</strong></p>
		<button class="knopf zweit" type="button" disabled={arbeitet} onclick={ausschalten}>
			Auf diesem Gerät ausschalten
		</button>
	{:else}
		<p class="hinweis">Push ist auf diesem Gerät aus.</p>
		<button class="knopf" type="button" disabled={arbeitet} onclick={einschalten}>
			Push auf diesem Gerät einschalten
		</button>
	{/if}
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
</div>

<style>
	p {
		margin: 0;
	}
	.knopf {
		justify-self: start;
	}
</style>
