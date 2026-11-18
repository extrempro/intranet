<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<a class="skip" href="#inhalt">Zum Inhalt springen</a>
<main id="inhalt">
	{@render children()}
</main>
