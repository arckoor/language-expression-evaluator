"use strict";
import jsLevenshtein from "./js-levenshtein/js-levenshtein.js";

const LeeDebugMode = true; // make this true to print debug messages
const LeeConfigFileName = "./LeeAssets/config/LeeConfig.json";
const LeeConfig = {};
const LeeCommands = ["!commands", "!help", "!clear", "!reinit", "!search"];
const LeeStringDistance = new jsLevenshtein();
const LeeChatlogContainer = document.getElementById("lee__chatlog__container");
const LeeInput = document.getElementById("lee__input");
const LeeCssSelectors = {
	lock:  "lee__input__disabled",
	chatlogMsgContainer: "lee__chatlog__message__container",
	usrMsgContainer: "lee__user__message__container",
	selfMsgContainer: "lee__self__message__container",
	msgIdentifier: "lee__message__identifier",
	noSelect: "lee__no__select",
	msgContainer: "lee__message__container",
	search: "lee__search__highlight",
	error: "lee__error__message",
	warning: "lee__warning__message",
	debug: "lee__debug__message",
	selection: "lee__selection",
};

let LeeResponses;
let LeePreviousKey;
let LeeMatches = {};
let LeeSegments = {};
let LeeHistory = [];
let LeeHistoryIndex = 0;

LeeLockWrapper(Lee);

// - - - init - - -
async function Lee() {
	await LeeLoadConfig();
	LeeSanitizeData();
	LeeCreateWeights();
	LeeSetEqualNameLength();
	if (LeeConfig.initMsg !== undefined && LeeConfig.initMsg !== null) {
		await LeeConstructMessage(LeeConfig.leeName, LeeConfig.initMsg, LeeConfig.initMsgDelay);
	}
	LeeInput.addEventListener("keydown", LeeInputListener);
}

async function LeeLoadConfig() {
	let data;
	try {
		data = await ( await fetch(LeeConfigFileName) ).json();
	} catch (error) {
		LeeConfig.debugName = "[DEBUG]: ";
		LeePrintDebugError(`Error while reading ${LeeConfigFileName}:\n${error}.\nExecution halted.`);
		throw error;
	}
	for (const key in data.config) {
		LeeConfig[key] = data.config[key];
	}
	LeeResponses = data.rules;
}

function LeeSanitizeData() {
	for (const topic in LeeResponses) {
		for (const rule in LeeResponses[topic]) {
			const cRule = LeeResponses[topic][rule];
			for (const key of LeeConfig.attributes) {
				if (!(key in cRule)) {
					let _default = null;
					switch(key) { // initialize non-existent keys
						case "counter":
							_default = 0;
							break;
						case "random":
						case "encode":
							_default = false;
							break;
						case "contextExtend":
							if (cRule["response"] && cRule["response"].length > 1 && LeeConfig.autoExtendContext) {
								_default = true;
							} else {
								_default = false;
							}
							break;
						case "context":
							_default = [];
					}
					cRule[key] = _default;
				}
			}
			for (const key of ["match", "response", "context"]) { // transform to array to make indexing, counting and referring easier
				if (typeof(cRule[key]) === "string") {
					cRule[key] = [cRule[key]];
				}
			}
			if (cRule["contextExtend"] !== false && cRule["response"] && cRule["response"].length > 1) {
				if (cRule["contextExtend"] === true || LeeConfig.autoExtendContext === true) {
					const contextArray = cRule["context"];
					LeeConfig.context.forEach((v) => { if (!contextArray.includes(v)) { contextArray.push(v); } });
				}
			}
			if (cRule["match"]) { // construct rule to key mapping
				const _match = cRule["match"];
				const matchKey = `${topic}.${rule}`;
				for (let match of _match) {
					let originalMatch = match;
					match = match.toLowerCase();
					if (!LeeMatches[match]) {
						LeeMatches[match] = matchKey;
					} else {
						if (LeeDebugMode) {
							LeePrintDebugError(`Match "${originalMatch}" of ${matchKey} is already used in ${LeeMatches[match]}`);
						}
					}
				}
			}
		}
	}
}

function LeeCreateWeights() {
	for (const key in LeeMatches) {
		for (let part of key.split(" ")) {
			part = LeeRemoveSymbols(part);
			if (!LeeSegments[part]) { // count occurrences
				LeeSegments[part] = 1;
			} else {
				LeeSegments[part] += 1;
			}
		}
	}
}

function LeeSetEqualNameLength() {
	let maxNameLen = 0;
	for (const key in LeeConfig) { // compute max length of all names
		if (key.includes("Name")) {
			if (key.includes("debug")) { // only include debug if DebugMode is true, otherwise names could be unnecessarily long
				if (LeeDebugMode) {
					maxNameLen = Math.max(maxNameLen, LeeConfig[key].length + 1);
				}
			} else {
				maxNameLen = Math.max(maxNameLen, LeeConfig[key].length + 1);
			}
		}
	}
	for (const key in LeeConfig) { // set all to equal max length
		if (key.includes("Name")) {
			const lengthDiff = Math.abs(maxNameLen - LeeConfig[key].length); // get difference between max and name length
			LeeConfig[key] += String.fromCharCode(160).repeat(lengthDiff); // &nbsp;
		}
	}
}

// - - - match calculation - - -
function LeeCalculateMatch(input) {
	let cost = null;
	let bestKey = null;
	for (const key in LeeMatches) {
		let newCost = LeeCalculateCost(key, input); // iterate through every key
		if (cost === null || newCost < cost) { // only set if new cost is less than previous best cost
			cost = newCost;
			bestKey = LeeMatches[key];
			if (LeeDebugMode) {
				LeePrintDebugError(`Best cost is ${cost} with key "${key}" from rule ${LeeMatches[key]}`, LeeCssSelectors.debug);
			}
		}
		if (cost === 0) { // exact match, short-circuit
			return bestKey;
		}
	}
	if (cost !== null && input.length * LeeConfig.suggestionRange[0] <= cost && cost <= input.length * LeeConfig.suggestionRange[1]) {
		LeeHandleSuggestion(input, bestKey);
		return -1;
	} else if (cost === null || input.length * LeeConfig.errorMargin < cost) { // too many edits to be made with levenshtein algorithm, likely not a close match
		return null;
	}
	return bestKey;
}

function LeeCalculateCost(key, input) {
	key = key.toLowerCase();
	input = input.toLowerCase();
	const distance = LeeStringDistance.getDistance(key, input);
	let keySegments = LeeRemoveSymbols(key).split(" ");
	let inputSegments = LeeRemoveSymbols(input).split(" ");
	let partToRemove = null;

	let combinedPartDistance = 0;
	for (const partInput of inputSegments) { // match each input segment to the closest rule segment
		let lowestPartDistance = null;
		for (const partKey of keySegments) {
			let partDistance = LeeStringDistance.getDistance(partInput, partKey);
			if (lowestPartDistance === null || partDistance < lowestPartDistance) {
				lowestPartDistance = partDistance;
				partToRemove = partKey;
			}
		}
		if (keySegments.length > 1) {
			keySegments.splice(keySegments.indexOf(partToRemove), 1); // remove the closest match so it doesn't get used again
		}
		let multiplier = 1;
		if (LeeSegments[partInput]) {
			multiplier = 1 / (LeeSegments[partInput] ** LeeConfig.weights.segmentPower); // this number decreases with number of occurrences of a given word
		}
		combinedPartDistance += lowestPartDistance * multiplier;
	}
	return combinedPartDistance * LeeConfig.weights.partMultiplier + distance * LeeConfig.weights.distanceMultiplier;
}

function LeeHandleSuggestion(originalInput, closestKey) {
	let bestKey = LeeIndexFromString(closestKey);
	if (LeeDebugMode) {
		LeePrintDebugError(`Computing closest match for key ${closestKey}`, LeeCssSelectors.debug);
	}
	let closestMatch = null;
	let cost = null;
	for (const key of bestKey["match"]) {
		let newCost = LeeStringDistance.getDistance(key, originalInput);
		if (cost === null || newCost < cost) {
			cost = newCost;
			closestMatch = key;
		}
	}
	let reply = `${LeeConfig.undefinedMessage} ${LeeConfig.suggestionMessage}\n${closestMatch}`;
	LeeConstructMessage(LeeConfig.leeName, reply);
	LeeScrollDown();
}

// - - - match reply - - -
async function LeeReplyFromKey(key, previousKey = null) {
	const rule = LeeIndexFromString(key);
	let reply = null;
	reply ??= LeeModuleExists(rule);
	reply ??= LeeModuleRandom(rule);
	reply ??= LeeModuleSequence(rule);
	reply ??= await LeeModuleRef(rule, key, previousKey);
	if (reply !== null && rule !== undefined && !LeeCompareArray(reply, [undefined]) && !LeeCompareArray(reply, [null])) {
		return Array.isArray(reply) ? reply : [reply, key, rule["delay"], rule["encode"]];
	} else if (LeeDebugMode && rule !== undefined && !LeeCompareArray(reply, [null])) {
		let prevkeyAddition = ""; // used when the key is recursive
		if (previousKey) {
			prevkeyAddition = `\n\nFrom key:\n${previousKey} : ${LeePrettyJSON(LeeIndexFromString(previousKey))}`;
		}
		LeePrintDebugError(`No response defined for key\n${key} : ${LeePrettyJSON(LeeIndexFromString(key))}${prevkeyAddition}`);
		return [null];
	}
	return reply;
}

function LeeModuleExists(rule) {
	if (rule !== undefined) {
		return null;
	}
	return [undefined];
}

function LeeModuleRandom(rule) {
	if (rule["response"] !== null && rule["random"]) {
		return rule["response"][LeeRandint(0, rule["response"].length - 1)];
	}
	return null;
}

function LeeModuleSequence(rule) {
	if (rule["response"] !== null) {
		if (rule["counter"] !== rule["response"].length) {
			const temp = rule["response"][rule["counter"]];
			rule["counter"]++;
			return temp;
		} else if (rule["ref"] !== null) {
			return null;
		} else {
			return rule["response"][rule["counter"] - 1];
		}
	}
	return null;
}

async function LeeModuleRef(rule, key, previousKey) {
	if (rule["ref"] !== null) {
		let newKey = rule["ref"];
		if (newKey.includes("this.")) { // if in the same subkey, take the original key, remove the lowest level key and then append everything after "this."
			newKey = key.substring(0, key.lastIndexOf(".") + 1) + newKey.replace("this.", "");
		}
		if (previousKey === key) { // would recurse until infinity (or until the stack runs out of space)
			if (LeeDebugMode) {
				LeePrintDebugError(`Recursion detected.\n${key} : ${LeePrettyJSON(LeeIndexFromString(key))}`);
			}
			return [null];
		}
		if (previousKey === null) {
			previousKey = key; // set up recursion safety
		}
		return await LeeReplyFromKey(newKey, previousKey); // recurse to resolve new key
	}
	return null;
}

function LeeIndexFromString(responseKey) {
	if (!responseKey) {
		return undefined;
	}
	if (responseKey.indexOf("rules.") === 0) {
		responseKey = responseKey.replace("rules.", "");
	}
	const subkeys = responseKey.split(".");
	let currentObject = LeeResponses;
	for (const key of subkeys) {
		if (currentObject && currentObject[key]) {
			currentObject = currentObject[key]; // resolve key
		} else {
			if (LeeDebugMode) {
				LeePrintDebugError(`Key "${responseKey}" does not exist.`);
			}
			return undefined; // the supplied key does not exist, return undefined and let calling function handle
		}
	}
	return currentObject;
}

function LeeCheckContext(input) {
	if (!LeePreviousKey) { return false; }
	const previousRule = LeeIndexFromString(LeePreviousKey);
	if (previousRule["response"] && previousRule["response"].length > 1) {
		let cost = null;
		for (const context of previousRule["context"]) {
			let newCost = LeeCalculateCost(context, input);
			if (cost === null || newCost < cost) {
				cost = newCost;
			}
		}
		if (cost !== null && input.length * LeeConfig.contextMargin > cost) {
			return true;
		}
	}
	return false;
}

// - - - commands - - -
function LeeDetectCommand(input) {
	for (const command of LeeCommands) {
		if (input.split(" ")[0].includes(command)) { // detects commands only if they occur at the start
			return	true;
		}
	}
	return false;
}

function LeeHandleCommand(input) {
	const command = input.split(" ")[0];
	switch (command) {
		case "!help":
		case "!commands":
			LeeCommandListCommands();
			break;
		case "!clear":
			LeeCommandClear();
			break;
		case "!reinit":
			LeeCommandReinit();
			break;
		case "!search":
			LeeCommandSearch(input);
			break;
	}
}

function LeeCommandListCommands() {
	let reply = `!commands       : shows this explanation
!clear          : removes all messages from the chatlog
!reinit         : reloads LeeConfig.json and resets all parameters to their initial values (debug mode required)
!search <query> : searches every message for the string <query>`;
	LeeConstructMessage(LeeConfig.leeName, reply, 300);
}

function LeeCommandClear() {
	LeeChatlogContainer.innerHTML = "";
}

function LeeCommandSearch(query) {
	for (const child of LeeChatlogContainer.children) {
		child.classList.remove(LeeCssSelectors.search); // remove from everything
	}
	let searchQuery = query.replace("!search", "").trim().toLowerCase();
	let children = Array.from(LeeChatlogContainer.children);
	children.forEach ((child, index) => {
		if (child.innerText.toLowerCase().includes(searchQuery) && index !== children.length - 1) { // only if innerText contains the search query and it is not the search query itself
			child.classList.add(LeeCssSelectors.search);
		}
	});
}

function LeeCommandReinit() {
	if (LeeDebugMode) {
		// reset all attributes
		LeeResponses = null;
		LeeMatches = {};
		LeeSegments = {};
		LeeHistory = [];
		LeeHistoryIndex = 0;
		LeeLockWrapper(Lee); // call init function again
		LeeScrollDown();
	}
}

// - - - IO - - -
function LeeInputListener(event) {
	if (event.code === "Enter") {
		LeeLockWrapper(LeeGetInput);
	} else if (event.code === "ArrowUp") {
		event.preventDefault(); // would move caret to the left
		LeeSetFromHistory(1);
	} else if (event.code === "ArrowDown") {
		event.preventDefault();
		LeeSetFromHistory(-1);
	}
}

async function LeeGetInput() {
	let userInput = LeeInput.value;
	LeeInput.value = null;
	let treatedInput = LeeSanitizeInput(userInput);
	if (treatedInput === "" || treatedInput === " ") {
		return;
	}
	LeeAddToHistory(userInput);
	await LeeConstructMessage(LeeConfig.userName, userInput); // show what user typed
	if (LeeConfig.enableCommands && LeeDetectCommand(treatedInput)) {
		LeeHandleCommand(treatedInput);
		return;
	}
	let results;
	if (LeeCheckContext(treatedInput)) {
		results = await LeeReplyFromKey(LeePreviousKey);
	} else {
		const bestMatch = LeeCalculateMatch(treatedInput);
		if (bestMatch === -1) { return; }
		results = await LeeReplyFromKey(bestMatch);
	}
	let reply = results[0];
	LeePreviousKey = results[1];
	let delay = results[2];
	const encode = results[3];
	if ((reply === undefined || reply === null) && LeeConfig.undefinedMessage !== null) {
		reply = LeeConfig.undefinedMessage;
	}
	if (reply) {
		if (delay === undefined || delay === null) {
			delay = LeeRandint(LeeConfig.randomInterval[0], LeeConfig.randomInterval[1]);
		}
		await LeeConstructMessage(LeeConfig.leeName, reply, delay, encode);
	} else {
		if (LeeDebugMode) {
			LeePrintDebugError(`Expected a message, but got an empty reply from key\n${LeePreviousKey} : ${LeePrettyJSON(LeeIndexFromString(LeePreviousKey))}`, LeeCssSelectors.warning);
		}
	}
	LeeScrollDown();
}

function LeeSanitizeInput(message, lower = true) {
	message = message.trim(); // remove trailing and preceding spaces
	/*
	title: Remove all multiple spaces in Javascript and replace with single space [duplicate]
	author: Greg Shackles
	date: 12.03.2022
	source: https://stackoverflow.com/a/3286919
	*/
	message = message.replace(/\s\s+/g, " "); // remove multiple spaces
	if (lower) {
		message = message.toLowerCase();
	}
	return message;
}

async function LeeConstructMessage(from, message, delay = 0, encode = false) {
	if (!message) { return; }
	const fromUser = from === LeeConfig.userName;
	const chatlogMsgContainer = document.createElement("div");
	const msgIdentifier = document.createElement("div");
	const msgContainer = document.createElement("div");
	if (from) {
		chatlogMsgContainer.appendChild(msgIdentifier);
	}
	chatlogMsgContainer.appendChild(msgContainer);

	chatlogMsgContainer.classList = LeeCssSelectors.chatlogMsgContainer + " " + (fromUser ? LeeCssSelectors.usrMsgContainer : LeeCssSelectors.selfMsgContainer);
	// if from user use user background color else use lee background color
	msgIdentifier.classList = LeeCssSelectors.msgIdentifier + " " + LeeCssSelectors.noSelect;
	msgIdentifier.innerText = from;

	msgContainer.classList = LeeCssSelectors.msgContainer + " " + LeeCssSelectors.selection;
	if (encode) { // <a> links and other html elements
		msgContainer.innerHTML = message;
	} else {
		msgContainer.innerText = message;
	}

	await LeeSleep(delay);
	LeeChatlogContainer.appendChild(chatlogMsgContainer);
	LeeScrollDown();
	return chatlogMsgContainer; // return to potentially apply more styling to the container
}

async function LeePrintDebugError(msg, severity = LeeCssSelectors.error) {
	const debugMsg = await LeeConstructMessage(LeeConfig.debugName, msg);
	debugMsg.classList.add(severity);
}


function LeeAddToHistory(item) {
	if (LeeHistory[0] !== item) {
		LeeHistory.unshift(item);
	}
	LeeHistoryIndex = -1;
}

function LeeSetFromHistory(index) {
	if (LeeHistoryIndex + index === -1) {
		LeeHistoryIndex = -1;
		LeeInput.value = null;
	}
	if (LeeHistoryIndex + index > -1 && LeeHistoryIndex + index < LeeHistory.length) {
		LeeHistoryIndex += index;
	}
	if (LeeHistory[LeeHistoryIndex]) {
		LeeInput.value = LeeHistory[LeeHistoryIndex];
	}
	LeeInput.setSelectionRange(LeeInput.value.length, LeeInput.value.length);
}

function LeeScrollDown() {
	LeeChatlogContainer.scrollTop = LeeChatlogContainer.scrollHeight;
}

// - - - IO blocking - - -
function LeeObtainLock() {
	LeeInput.disabled = true;
	LeeInput.classList.add(LeeCssSelectors.lock);
}

function LeeDiscardLock() {
	LeeInput.disabled = false;
	LeeInput.classList.remove(LeeCssSelectors.lock);
	LeeInput.focus();
}

async function LeeLockWrapper(func, ...args) {
	LeeObtainLock();
	await func(...args); // no inputs permitted during function call
	LeeDiscardLock();
}

// - - - utility - - -
function LeeCompareArray(a1, a2) {
	if (!Array.isArray(a1) || !Array.isArray(a2)) {
		return false;
	} else if (a1.length !== a2.length) {
		return false;
	}
	for (let i = 0; i < a1.length; i++) {
		if (!(a1[i] === a2[i])) { return false; }
	}
	return true;
}

function LeePrettyJSON(msg) {
	return JSON.stringify(msg, null, 4);
}

function LeeRemoveSymbols(str) {
	return str.replace(/[^a-zA-Z0-9 ]/g, ""); // select everything a-z A-Z 0-9 and whitespace, ^ inverts everything -> removes everything not in the previously selected, /g is for all occurrences
}

/*
title: What is the JavaScript version of sleep()?
author: Dan Dascalescu
date: 06.03.2022
source: https://stackoverflow.com/a/39914235
*/
function LeeSleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

/*
title: Math.random()
date: 14.03.2022
source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values_inclusive
*/
function LeeRandint(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}
