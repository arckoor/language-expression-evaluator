import { Replies } from "./enums";
import type { Rules, ProcessedRule } from "./types";

export function indentJSON(msg: string): string {
	return JSON.stringify(msg, null, 4);
}

export function removeSymbols(str: string): string {
	return str.replace(/[^a-zA-Z0-9 ]/g, "");
}

export function clamp(min: number, num: number, max: number): number {
	return Math.min(Math.max(num, min), max);
}

export function splitFirstSpace(input: string): [string, string] {
	if (input.indexOf(" ") !== -1) {
		return [input.substring(0, input.indexOf(" ")), input.substring(input.indexOf(" ")+1)];
	}
	return [input, ""];
}

export function sanitize(input: string): string {
	input = input.replace(/\s\s+/g, " ");
	input = input.toLowerCase();
	input = input.trim();
	return input;
}

export function indexFromString(responseKey: string, responses: Rules): ProcessedRule {
	if (Object.values(Replies).includes(responseKey as Replies)) {
		return {} as ProcessedRule;
	}
	if (responseKey.indexOf("rules.") === 0) {
		responseKey = responseKey.replace("rules.", "");
	}
	const subkeys = responseKey.split(".");

	let rule: ProcessedRule;
	//				"topic"		"rule"
	rule = responses[subkeys[0]][subkeys[1]];
	if (!rule) {
		throw new Error(`Key ${responseKey} not found`);
	}
	return rule;
}

export function localToGlobalKey(key: string, groupKey: string): string {
	if (key.includes("this.")) { // if in the same subkey, take the original key, remove the lowest level key and then append everything after "this."
		key = groupKey.substring(0, groupKey.lastIndexOf(".") + 1) + key.replace("this.", "");
	}
	return key;
}

// https://stackoverflow.com/a/39914235
export function sleep(ms: number): Promise<void> {
	return new Promise(r => setTimeout(r, ms));
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values_inclusive
export function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min);
}
