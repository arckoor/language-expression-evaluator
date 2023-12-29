<script lang="ts">
	import Message from "@/components/message.svelte";

	import { onMount } from "svelte";
	import { config, matches, responses } from "virtual:config";

	import { History } from "@/ts/history";
    import { Commands } from "@/ts/commands";
	import { IO } from "@/ts/io";
	import { MessageQueue } from "@/ts/queue";
	import { sanitize, sleep } from "@/ts/util";
	import { Users } from "@/ts/enums";

	const history = new History();
	const cmd = new Commands(config);
	const io = new IO(config, matches, responses);
	let messageQueue = new MessageQueue(config);

	let chatLogContainer: HTMLDivElement;
	let inputElement: HTMLInputElement;
	let inputDisabled = false;
	let input = "";

	onMount(async () => {
		if (config.initMsg) {
			messageQueue.push({
				fromName: config.leeName,
				fromType: Users.SELF,
				message: config.initMsg
			});
			refresh();
		}
	});

	async function processInput(input: string, queue: MessageQueue): Promise<void> {
		const originalInput = input;
		input = sanitize(input);
		if (input == "" || input == " ") {
			return;
		}
		queue.push({
			fromName: config.userName,
			fromType: Users.USER,
			message: originalInput
		});
		refresh();

		if (config.enableCommands && cmd.detectCommand(input)) {
			cmd.processCommand(input, queue);
			return;
		}
		const [reply, delay, encode] = io.getReply(input);
		await sleep(delay);
		queue.push({
			fromName: config.leeName,
			fromType: Users.SELF,
			message: reply,
			encode: encode
		});
		refresh();
	}

	async function handleInput(input: string): Promise<void> {
		history.addToHistory(input);
		await processInput(input, messageQueue);
	}

	async function handleKeys(ev: KeyboardEvent): Promise<void> {
		if (ev.code === "Enter") {
			const inputValue = input;
			input = "";
			inputDisabled = true;
			await handleInput(inputValue);
			inputDisabled = false;
			setTimeout(() => inputElement.focus(), 0);
		} else if (ev.code === "ArrowUp") {
			ev.preventDefault(); // prevent caret to the left
			input = history.getPreviousHistory();
		} else if (ev.code === "ArrowDown") {
			input = history.getNextHistory();
		}
	}

	function refresh(): void {
		messageQueue = messageQueue;
		setTimeout(() => chatLogContainer.scrollTop = chatLogContainer.scrollHeight);
	}
</script>

<main>
	<div class="container">
		<div class="log-container" bind:this={chatLogContainer}>
			{#each messageQueue.getQueue() as msg}
				<Message {...msg} />
			{/each}
		</div>
		<div class="foot flex">
			<div class="input-container no-sel">
				&#62;
				<input
					type="text"
					class={"input sel" + (inputDisabled ? " disabled" : "")}
					disabled={inputDisabled}
					on:keydown={handleKeys}
					bind:value={input}
					bind:this={inputElement}
				>
			</div>
		</div>
	</div>
</main>

<style>
.container {
	overflow: hidden;
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	width: 50%;
	height: 50%;
	border-radius: 15px;
	border: 3px solid var(--container-bg-col);
	background: var(--log-bg-col);
}

.log-container {
	height: 93%;
	overflow: auto;
	scroll-behavior: smooth;
	background: var(--log-bg-col);
}

.log-container::-webkit-scrollbar {
	width: 20px;
}

.log-container::-webkit-scrollbar-thumb {
	border-radius: 15px;
	background-color: var(--scroll-thumb-col);
	border: 5px solid var(--log-bg-col);
}

.log-container::-webkit-scrollbar-thumb:hover {
	background-color: var(--scroll-thumb-hover-col);
}

.foot {
	height: 7%;
	color: var(--text-col);
	background: var(--footer-bg-col);
	min-width: 100%;
	bottom: 0;
	position: absolute;
	display: flex;
	align-items: center;
	justify-content: center;

}

.input-container {
	display: flex;
	align-self: stretch;
	align-items: center;
	justify-content: flex-start;
	margin-left: 10px;
	width: 100%;
	font-size: 30px;
}

.input {
	display: flex;
	width: 100%;
	height: 25px;
	margin: 0 20px 0 10px;
	border-radius: 5px;
	font-size: 25px;
	transition: border 0.5s;
	border: 2px solid var(--input-border-col);
	background: var(--input-bg-col);
	font-family: var(--font-family);
}

.input:focus {
	outline: none;
	border: 2px solid var(--input-focus-col);
}

.disabled {
	background-color: var(--disabled-col);
}

.flex {
	display: flex;
	justify-content: center;
	align-items: center;
}
</style>
