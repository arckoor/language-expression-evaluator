import config from "./config";
import { indexFromString, localToGlobalKey } from "./util";
import type { CConfig, Range, Rules, Rule, ProcessedRule } from "./types";

const errors: string[] = [];

export default function parser() {
	const virtualModuleId = "virtual:config";
	const resolvedVirtualModuleId = "\0" + virtualModuleId;
	const { config, matches, responses } = processConfig();

	return {
		name: "config-parser",
		resolveId(id: string) {
			if (id === virtualModuleId) {
				return resolvedVirtualModuleId;
			}
		},
		load(id: string) {
			if (id === resolvedVirtualModuleId) {
				return `
				export const config = ${JSON.stringify(config)};
				export const matches = ${JSON.stringify(matches)};
				export const responses = ${JSON.stringify(responses)};
				`;
			}
		}
	};
}

function processConfig() {
	const cfg: CConfig = config.config;
	const rules: Rules = config.rules as unknown as Rules; // unfortunately necessary because of the way the config is typed
	const mapping: Record<string, string> = {};
	for (const topic in rules) {
		for (const rule in rules[topic]) {
			const currentRule: Rule = rules[topic][rule];
			const processedRule = standardize(currentRule, cfg);
			extendContext(processedRule, cfg);
			ruleToKey(processedRule, topic, rule, mapping);
		}
	}
	validateConfig(cfg);
	validateRules(rules);
	return { config: cfg, matches: mapping, responses: rules };
}

function standardize(currentRule: Rule, cfg: CConfig): ProcessedRule {
	for (const key of ["match", "response", "ref", "delay", "random", "encode", "context", "contextExtend", "counter"]) {
		if (!(key in currentRule)) {
			let _default: number | boolean | String[] | undefined;
			switch (key) {
				case "counter":
					_default = 0;
					break;
				case "random":
				case "encode":
					_default = false;
					break;
				case "contextExtend":
					if (currentRule.response && currentRule.response.length > 1 && cfg.autoExtendContext) {
						_default = true;
					} else {
						_default = false;
					}
					break;
				case "context":
					_default = [];
					break;
				default:
					_default = undefined;
			}
			currentRule[key] = _default;
		}
	}

	for (const key of ["match", "response", "context"]) { // transform to array to make indexing, counting and referring easier
		if (typeof currentRule[key] === "string") {
			currentRule[key] = [currentRule[key]];
		}
	}
	return currentRule as ProcessedRule;
}

function extendContext(currentRule: ProcessedRule, cfg: CConfig): void {
	if (currentRule.contextExtend !== false && currentRule.response && currentRule.response.length > 1) {
		if (currentRule.contextExtend === true || cfg.autoExtendContext === true) {
			const contextArray = currentRule.context;
			cfg.context.forEach((v: string) => { if (!contextArray.includes(v)) { contextArray.push(v); } });
		}
	}
}

function ruleToKey(currentRule: ProcessedRule, topic: string, rule: string, mapping: Record<string, string>): void {
	if (currentRule.match) {
		const _match = currentRule.match;
		const matchKey = `${topic}.${rule}`;
		for (let match of _match) {
			match = match.toLowerCase();
			if (match in mapping) {
				errors.push(`Duplicate match "${match}" in rule "${matchKey}" and "${mapping[match]}".`);
			}
			if (match === "") continue;
			mapping[match] = matchKey;
		}
	}
}

function validateRange(range: Range, name: string, restrictTo01: boolean = false): string | null {
	const { lbound, ubound } = range;
	if (lbound < 0 || ubound < 0) {
		return `${name}.lbound and ${name}.ubound must be greater than 0.`;
	}
	if (lbound >= ubound) {
		return `${name}.lbound must be smaller than ${name}.ubound.`;
	}
	if (restrictTo01 && (lbound > 1 || ubound > 1)) {
		return `${name}.lbound and ${name}.ubound must be smaller than 1.`;
	}
	return null;
}

function validateConfig(cfg: CConfig): void {
	if (cfg.initMsgDelay < 0) {
		errors.push("initMsgDelay must be greater than 0.");
	}
	if (cfg.contextMargin < 0 || cfg.contextMargin > 1) {
		errors.push("contextMargin must be between 0 and 1.");
	}
	if (cfg.errorMargin < 0 || cfg.errorMargin > 1) {
		errors.push("errorMargin must be between 0 and 1.");
	}
	const suggestionRangeError = validateRange(cfg.suggestionRange, "suggestionRange", true);
	if (suggestionRangeError) {
		errors.push(suggestionRangeError);
	}
	const randomIntervalError = validateRange(cfg.randomInterval, "randomInterval");
	if (randomIntervalError) {
		errors.push(randomIntervalError);
	}
	if (cfg.undefinedMessage === "") {
		errors.push("undefinedMessage must not be empty.");
	}
	if (cfg.suggestionMessage === "") {
		errors.push("suggestionMessage must not be empty.");
	}
	if (errors.length > 0) {
		throw new Error(errors.join("\n"));
	}
}

function validateSelfReference(badKeys: string[], rules: Rules, key: string): string | null {
	const rule = indexFromString(key, rules);
	if (!rule.ref) return null;

	const newKey = localToGlobalKey(rule.ref, key);
	if (badKeys.includes(newKey)) return `Rule "${key}" references bad key "${newKey}".`;

	const newRule = indexFromString(newKey, rules);
	if (rule.match.every((v: string) => newRule.match.includes(v))) {
		return `Rule "${key}" references itself.`;
	}
	return null;
}

function validateCircularReferences(badKeys: string[], rules: Rules, key: string, previousKey: string | null): string | null {
	if (key === previousKey) {
		return `Circular reference detected in rule "${key}".`;
	}
	const rule = indexFromString(key, rules);
	if (rule.ref) {
		const newKey = localToGlobalKey(rule.ref, key);
		if (badKeys.includes(newKey)) return `Rule "${previousKey ? previousKey : key}" references bad key "${newKey}".`;
		return validateCircularReferences(badKeys, rules, newKey, previousKey ? previousKey : key);
	}
	return null;
}

function validateRules(rules: Rules): void {
	for (const topic in rules) {
		for (const rule in rules[topic]) {
			const currentRule: ProcessedRule = rules[topic][rule];
			if (currentRule.match.length === 0 && currentRule.ref === undefined) {
				errors.push(`Rule "${topic}.${rule}" has no match and no reference.`);
			}
			if (currentRule.response.length === 0) {
				errors.push(`Rule "${topic}.${rule}" has no response.`);
			}
			if (currentRule.delay && currentRule.delay < 0) {
				errors.push(`Rule "${topic}.${rule}" has a negative delay.`);
			}
		}
	}
	const badKeys: string[] = [];
	for (const topic in rules) {
		for (const rule in rules[topic]) {
			const key = `${topic}.${rule}`;
			const selfReferenceError = validateSelfReference(badKeys, rules, key);
			if (selfReferenceError) {
				errors.push(selfReferenceError);
				badKeys.push(key);
			}
			const circularError = validateCircularReferences(badKeys, rules, key, null);
			if (circularError) {
				errors.push(circularError);
			}
		}
	}

	if (errors.length > 0) {
		throw new Error(errors.join("\n"));
	}
}
