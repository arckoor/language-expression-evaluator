import type { MessageItem, QueueItem, CConfig } from "./types";

export class MessageQueue {
	private cfg: CConfig;
	private queue: Array<QueueItem>;
	private maxLen: number;

	constructor(cfg: CConfig) {
		this.cfg = cfg;
		this.queue = [];
		this.maxLen = Math.max(this.cfg.leeName.length, this.cfg.userName.length);
	}

	public length(): number {
		return this.queue.length;
	}

	public pop(): QueueItem {
		if (this.queue.length === 0) {
			throw new Error("Queue is empty");
		}
		return this.queue.pop() as QueueItem;
	}

	public push(msg: MessageItem): void {
		const message = this.fillDefaults(msg);
		this.queue.push(message);
	}

	public clear(): void {
		this.queue = [];
	}

	public getQueue(): Array<QueueItem> {
		return this.queue;
	}

	private fillDefaults(msg: MessageItem): QueueItem {
		const message = <QueueItem> msg;
		message.maxLen = this.maxLen;
		message.highlight = false;
		message.encode ??= false;
		return message;
	}
}
