import { MessageQueue } from "./queue";
import { splitFirstSpace } from "./util";
import { Users } from "./enums";
import type { CConfig } from "./types";

export class Commands {
	cfg: CConfig;
	commands: Record<string, [Function, string]>;

	constructor(cfg: CConfig) {
		this.cfg = cfg;
		this.commands = {
			...this.commandClear(),
			...this.commandSearch(),
			...this.commandListCommands()
		};
	}

	public detectCommand(input: string): boolean {
		if (!this.cfg.enableCommands) return false;
		const cmd = splitFirstSpace(input)[0];
		for (const alias of Object.keys(this.commands)) {
			if (cmd === alias) {
				return true;
			}
		}
		return false;
	}

	public processCommand(input: string, queue: MessageQueue): void {
		const [cmd, query] = splitFirstSpace(input);
		const [callback] = this.commands[cmd];
		if (callback) {
			callback(this, queue, query);
		}
	}

	private commandClear(): Record<string, [Function, string]> {
		const fun = (_: Commands, queue: MessageQueue) => {
			queue.clear();
		};
		const description = "Clears all messages from the chat window.";
		return { "!clear": [fun, description] };
	}

	private commandSearch(): Record<string, [Function, string]> {
		const fun = (_: Commands, queue: MessageQueue, query: string) => {
			query = query.toLowerCase().trim();
			for (const item of queue.getQueue()) {
				if (
					item.message &&
					!(this.detectCommand(item.message) && item.fromType === Users.USER) &&
					item.message.toLowerCase().includes(query)
				) {
					item.highlight = true;
				} else {
					item.highlight = false;
				}
			}
		};
		const description = "Searches all message for the <query> and highlights them.";
		return { "!search": [fun, description] };
	}

	private commandListCommands(): Record<string, [Function, string]> {
		let message: string | null = null;
		const fun = (self: Commands, queue: MessageQueue) => {
			if (!message) {
				const commands = [];
				for (const command of Object.keys(self.commands)) {
					let skip = false;
					for (const alias of commands) {
						if (alias.fun === self.commands[command][0]) {
							alias.command += ", " + command;
							skip = true;
							break;
						}
					}
					if (skip) continue;
					commands.push({ command, fun: self.commands[command][0], description: self.commands[command][1] });
				}

				let msg = "";
				for (const command of commands) {
					msg += command.command + " - " + command.description + "\n";
				}

				message = msg;
			}
			queue.push({
				fromName: self.cfg.leeName,
				fromType: Users.SELF,
				message: message
			});
		};
		const description = "Lists all available commands.";
		return { "!commands": [fun, description], "!help": [fun, description] };
	}
}
