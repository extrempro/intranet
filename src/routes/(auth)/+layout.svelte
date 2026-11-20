<script lang="ts">
	let { data, children } = $props();
</script>

<div class="flaeche" style={data.akzent}>
	<main class="karte auth" id="inhalt">
		<div class="marke">
			<div class="logo" aria-hidden="true">{data.marke.kurz}</div>
			<div>
				<div class="titel">Intranet</div>
				<div class="mandant">{data.marke.name}</div>
			</div>
		</div>
		{@render children()}
	</main>
</div>

<style>
	.flaeche {
		min-height: 100vh;
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
