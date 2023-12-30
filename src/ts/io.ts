import { randomInt, indexFromString, localToGlobalKey } from "./util";
import { Replies } from "./enums";
import type { CConfig, Rules, ProcessedRule } from "./types";

import jaroWinkler from "jaro-winkler";

export class IO {
	cfg: CConfig;
	matches: Record<string, string>;
	responses: Rules;
	previousKey: string;
	suggestedMatch: string;
	distance = jaroWinkler;

	constructor(
		cfg: CConfig,
		matches: Record<string, string>,
		responses: Rules
	) {
		this.cfg = cfg;
		this.matches = matches;
		this.responses = responses;

		this.previousKey = "";
		this.suggestedMatch = "";
	}

	public getReply(input: string): [string, number, boolean] {
		const key = this.getReplyKey(input);
		return this.getDeepReply(key);
	}

	private getDeepReply(key: string): [string, number, boolean] {
		const rule = indexFromString(key, this.responses);
		const reply =
			this.ruleModUnknown(key)
			?? this.ruleModSuggestion(key)
			?? this.ruleModRandom(rule)
			?? this.ruleModSequence(rule)
			?? this.ruleModRef(rule, key)
			;
		if (reply === null) throw new Error(`Key ${key} not found`);
		if (Array.isArray(reply)) return reply as unknown as [string, number, boolean];
		return [reply, this.ruleModDelay(rule), this.ruleModEncode(rule)];
	}

	private getReplyKey(input: string): string {
		const isContext = this.detectContext(input);
		if (isContext) {
			return this.previousKey;
		}
		const key = this.calculateMatch(input);
		switch (key) {
			case Replies.UNKNOWN:
				this.previousKey = "";
				break;
			case Replies.SUGGESTION:
				this.previousKey = "";
				break;
			default:
				this.previousKey = key;
				break;
		}
		return key;
	}

	private detectContext(input: string): boolean {
		if (!this.previousKey) return false;
		const previousRule = indexFromString(this.previousKey, this.responses);
		if (previousRule.response && previousRule.context && previousRule.context.length > 0) {
			let similarity = 0;
			for (const context of previousRule.context) {
				const newSimilarity = this.distance(context, input);
				if (newSimilarity > similarity) {
					similarity = newSimilarity;
				}
			}
			if (similarity > this.cfg.contextMargin) {
				return true;
			}
		}
		return false;
	}

	private calculateMatch(input: string): string | Replies {
		let similarity = 0;
		let bestKey: string = "";
		for (const key in this.matches) {
			let newSimilarity = this.distance(key, input);
			if (newSimilarity > similarity) {
				similarity = newSimilarity;
				bestKey = this.matches[key];
				this.suggestedMatch = bestKey;
			}
			if (similarity === 1) {
				return bestKey;
			}
		}
		if (this.cfg.suggestionRange.lbound < similarity && similarity < this.cfg.suggestionRange.ubound) {
			return Replies.SUGGESTION;
		} else if (similarity < this.cfg.errorMargin) {
			return Replies.UNKNOWN;
		}
		return bestKey;
	}

	private ruleModUnknown(key: string): string | null {
		if (key === Replies.UNKNOWN) {
			return this.cfg.undefinedMessage;
		}
		return null;
	}

	private ruleModSuggestion(key: string): string | null {
		if (key === Replies.SUGGESTION) {
			return this.cfg.undefinedMessage + "\n" + this.cfg.suggestionMessage +
				` "${indexFromString(this.suggestedMatch, this.responses).match[0]}"?`;
		}
		return null;
	}


	private ruleModRandom(rule: ProcessedRule): string | null {
		if (rule.response !== null && rule.random) {
			return rule.response[randomInt(0, rule.response.length - 1)];
		}
		return null;
	}

	private ruleModSequence(rule: ProcessedRule): string | null {
		if (rule.response) {
			if (rule.counter !== rule.response.length) {
				const temp = rule.response[rule.counter];
				rule.counter++;
				return temp;
			} else if (rule.ref) {
				return null;
			} else {
				return rule.response[rule.counter - 1];
			}
		}
		return null;
	}

	private ruleModRef(rule: ProcessedRule, key: string): [string, number, boolean] | null {
		if (rule.ref) {
			let newKey = localToGlobalKey(rule.ref, key);
			return this.getDeepReply(newKey);
		}
		return null;
	}

	private ruleModDelay(rule: ProcessedRule): number {
		if (rule && rule.delay !== undefined) {
			return rule.delay;
		}
		return randomInt(this.cfg.randomInterval.lbound, this.cfg.randomInterval.ubound);
	}

	private ruleModEncode(rule: ProcessedRule): boolean {
		if (rule && rule.encode) {
			return rule.encode;
		}
		return false;
	}
}
