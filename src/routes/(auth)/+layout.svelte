<script lang="ts">
	let { data, children } = $props();
</script>

<div class="flaeche akzent" style={data.akzent}>
	<main class="karte auth" id="inhalt">
		<div class="marke">
			{#if data.marke.logoHell}
				<img class="logobild logo-hell" src={data.marke.logoHell} alt="" />
				<img class="logobild logo-dunkel" src={data.marke.logoDunkel} alt="" />
			{:else}
				<div class="logo" aria-hidden="true">{data.marke.kurz}</div>
			{/if}
			<div>
				<div class="titel">Intranet</div>
				<div class="mandant">{data.marke.name}</div>
			</div>
		</div>
		{@render children()}
		{#if data.rechtliches.datenschutz || data.rechtliches.impressum}
			<p class="rechtliches">
				{#if data.rechtliches.datenschutz}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- externer Link -->
					<a href={data.rechtliches.datenschutz} rel="noopener">Datenschutz</a>
				{/if}
				{#if data.rechtliches.datenschutz && data.rechtliches.impressum}·{/if}
				{#if data.rechtliches.impressum}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- externer Link -->
					<a href={data.rechtliches.impressum} rel="noopener">Impressum</a>
				{/if}
			</p>
		{/if}
	</main>
</div>

<style>
	.rechtliches {
		margin: 0;
		font-size: 12px;
		color: var(--mu);
		text-align: center;
	}
	.logobild {
		max-height: 44px;
		max-width: 160px;
		width: auto;
		object-fit: contain;
	}
	.logo-dunkel {
		display: none;
	}
	:global([data-theme='dunkel']) .logo-hell {
		display: none;
	}
	:global([data-theme='dunkel']) .logo-dunkel {
		display: block;
	}
	@media (prefers-color-scheme: dark) {
		:global([data-theme='auto']) .logo-hell {
			display: none;
		}
		:global([data-theme='auto']) .logo-dunkel {
			display: block;
		}
	}
	.flaeche {
		min-height: 100vh;
		background: var(--bg);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
	}
	.auth {
		width: 100%;
		max-width: 440px;
		border-radius: 18px;
		padding: 32px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.marke {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.logo {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: var(--fill);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
	}
	.titel {
		font-weight: 700;
		font-size: 20px;
	}
	.mandant {
		font-size: 13px;
		color: var(--mu);
	}
	@media (max-width: 480px) {
		.auth {
			padding: 24px 18px;
		}
	}
</style>
