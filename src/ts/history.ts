export class History {
	history: string[];
	index: number;

	constructor() {
		this.history = [];
		this.index = -1;
	}

	public addToHistory(item: string): void {
		if (this.history[0] !== item) {
			this.history.unshift(item);
		}
		this.index = -1;
	}

	public getPreviousHistory(): string {
		this.index++;
		if (this.index > this.history.length-1) {
			this.index--;
		}
		return this.history[this.index];
	}

	public getNextHistory(): string {
		this.index--;
		if (this.index < -1) {
			this.index++;
			return "";
		}
		return this.history[this.index];
	}
}
