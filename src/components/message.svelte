<script lang="ts">
	import { clamp } from "@/ts/util";
	import { Users } from "@/ts/enums";

	export let fromName: string;
	export let message: string;
	export let fromType: Users;
	export let maxLen: number;
	export let encode: boolean;
	export let highlight: boolean;

	function determineBackground(type: Users): string {
		switch (type) {
			case Users.SELF:
				return "self";
			case Users.USER:
				return "user";
			default:
				return "self";
		}
	}
</script>

<main>
	<div class={"container " + (determineBackground(fromType)) + (highlight ? " highlight": "")}>
		{#if fromName}
			<div class="name no-sel">{fromName}:{#each Array(clamp(0, maxLen-fromName.length, Infinity)) as index (index)}&nbsp;{/each}</div>
		{/if}
		<div class="content sel">
			{#if encode}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html message}
			{:else}
				{message}
			{/if}
		</div>
	</div>
</main>

<style scoped>
main {
	color: var(--text-col);
}

@keyframes fade_in {
	0% { opacity: 0.15; }
	100% { opacity: 1; }
}

.container {
	animation: fade_in 1s;
	white-space: pre-wrap;
	margin: 10px 10px 10px 10px;
	display: flex;
	align-items: center;
	border-radius: 5px;
	font-size: 22px;
}

.container:last-child {
	margin-bottom: 10px;
}

.self {
	background: var(--self-msg-bg-col);
}

.user {
	background: var(--user-msg-bg-col);
}

.name {
	font-weight: bold;
	margin-left: 10px;
	margin-right: 5px;
	max-width: 40%;
}

.content {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	margin: 3px 10px;
	word-break: normal;
	overflow-wrap: anywhere;
}

.highlight {
	background-color: var(--highlight-col);
}
</style>
