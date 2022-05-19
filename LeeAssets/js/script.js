
"use strict";
const LEE_DEBUG_MODE = true; // make this true to print debug messages
const LEE_config_file_name = "./LeeAssets/config/LeeConfig.json";
const LEE_config = {};
const LEE_commands = ["!commands", "!help", "!clear", "!reinit", "!search"];
// eslint-disable-next-line no-undef
const LEE_lev = new js_levenshtein();
const LEE_chatlog_container = document.getElementById("lee__chatlog__container");
const LEE_input = document.getElementById("lee_input");
const LEE_css_selectors = {
	lock:  "lee__input__disabled",
	chatlog_msg_container: "lee__chatlog__message__container",
	usr_msg_container: "lee__user__message__container",
	self_msg_container: "lee__self__message__container",
	msg_identifier: "lee__message__identifier",
	no_select: "lee__no__select",
	msg_container: "lee__message__container",
	search: "lee__search__highlight",
	error: "lee__error__message",
	warning: "lee__warning__message",
	debug: "lee__debug__message",
	selection: "lee__selection",
};

let LEE_responses;
let LEE_previous_key;
let LEE_matches = {};
let LEE_segments = {};
let LEE_history = [];
let LEE_history_index = 0;

LEE_lock_wrapper(LEE);

// - - - init - - -
async function LEE() {
	await LEE_load_config();
	LEE_sanitize_data();
	LEE_create_weights();
	LEE_set_equal_name_length();
	if (LEE_config.initMsg !== undefined && LEE_config.initMsg !== null) {
		await LEE_construct_message(LEE_config.leeName, LEE_config.initMsg, LEE_config.initMsgDelay);
	}
	LEE_input.addEventListener("keydown", LEE_input_listener);
}

async function LEE_load_config() {
	let data;
	try {
		data = await ( await fetch(LEE_config_file_name) ).json();
	} catch (error) {
		LEE_config.debugName = "[DEBUG]: ";
		LEE_print_debug_error(`Error while reading ${LEE_config_file_name}:\n${error}.\nExecution halted.`);
		throw error;
	}
	for (const key in data.config) {
		LEE_config[key] = data.config[key];
	}
	LEE_responses = data.rules;
}

function LEE_sanitize_data() {
	for (const topic in LEE_responses) {
		for (const rule in LEE_responses[topic]) {
			const c_rule = LEE_responses[topic][rule];
			for (const key of LEE_config.attributes) {
				if (!(key in c_rule)) {
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
							if (c_rule["response"] && c_rule["response"].length > 1 && LEE_config.autoExtendContext) {
								_default = true;
							} else {
								_default = false;
							}
							break;
						case "context":
							_default = [];
					}
					c_rule[key] = _default;
				}
			}
			for (const key of ["match", "response", "context"]) { // transform to array to make indexing, counting and referring easier
				if (typeof(c_rule[key]) === "string") {
					c_rule[key] = [c_rule[key]];
				}
			}
			if (c_rule["contextExtend"] !== false && c_rule["response"] && c_rule["response"].length > 1) {
				if (c_rule["contextExtend"] === true || LEE_config.autoExtendContext === true) {
					const contextArray = c_rule["context"];
					LEE_config.context.forEach((v) => { if (!contextArray.includes(v)) { contextArray.push(v); } });
				}
			}
			if (c_rule["match"]) { // construct rule to key mapping
				const _match = c_rule["match"];
				const match_key = `${topic}.${rule}`;
				for (let match of _match) {
					let original_match = match;
					match = match.toLowerCase();
					if (!LEE_matches[match]) {
						LEE_matches[match] = match_key;
					} else {
						if (LEE_DEBUG_MODE) {
							LEE_print_debug_error(`Match "${original_match}" of ${match_key} is already used in ${LEE_matches[match]}`);
						}
					}
				}
			}
		}
	}
}

function LEE_create_weights() {
	for (const key in LEE_matches) {
		for (let part of key.split(" ")) {
			part = LEE_remove_symbols(part);
			if (!LEE_segments[part]) { // count occurrences
				LEE_segments[part] = 1;
			} else {
				LEE_segments[part] += 1;
			}
		}
	}
}

function LEE_set_equal_name_length() {
	let max_name_len = 0;
	for (const key in LEE_config) { // compute max length of all names
		if (key.includes("Name")) {
			if (key.includes("debug")) { // only include debug if DEBUG_MODE is true, otherwise names could be unnecessarily long
				if (LEE_DEBUG_MODE) {
					max_name_len = Math.max(max_name_len, LEE_config[key].length + 1);
				}
			} else {
				max_name_len = Math.max(max_name_len, LEE_config[key].length + 1);
			}
		}
	}
	for (const key in LEE_config) { // set all to equal max length
		if (key.includes("Name")) {
			const length_diff = Math.abs(max_name_len - LEE_config[key].length); // get difference between max and name length
			LEE_config[key] += String.fromCharCode(160).repeat(length_diff); // &nbsp;
		}
	}
}

// - - - match calculation - - -
function LEE_calculate_match(input) {
	let cost = null;
	let best_key = null;
	for (const key in LEE_matches) {
		let new_cost = LEE_calculate_cost(key, input); // iterate through every key
		if (cost === null || new_cost < cost) { // only set if new cost is less than previous best cost
			cost = new_cost;
			best_key = LEE_matches[key];
			if (LEE_DEBUG_MODE) {
				LEE_print_debug_error(`Best cost is ${cost} with key "${key}" from rule ${LEE_matches[key]}`, LEE_css_selectors.debug);
			}
		}
		if (cost === 0) { // exact match, short-circuit
			return best_key;
		}
	}
	if (cost !== null && input.length * LEE_config.suggestionRange[0] <= cost && cost <= input.length * LEE_config.suggestionRange[1]) {
		LEE_handle_suggestion(input, best_key);
		return -1;
	} else if (cost === null || input.length * LEE_config.errorMargin < cost) { // too many edits to be made with levenshtein algorithm, likely not a close match
		return null;
	}
	return best_key;
}

function LEE_calculate_cost(key, input) {
	key = key.toLowerCase();
	input = input.toLowerCase();
	const distance = LEE_lev.levenshtein(key, input);
	let key_segments = LEE_remove_symbols(key).split(" ");
	let input_segments = LEE_remove_symbols(input).split(" ");
	let part_to_remove = null;

	let combined_part_distance = 0;
	for (const partInput of input_segments) { // match each input segment to the closest rule segment
		let lowest_part_distance = null;
		for (const partKey of key_segments) {
			let part_distance = LEE_lev.levenshtein(partInput, partKey);
			if (lowest_part_distance === null || part_distance < lowest_part_distance) {
				lowest_part_distance = part_distance;
				part_to_remove = partKey;
			}
		}
		if (key_segments.length > 1) {
			key_segments.splice(key_segments.indexOf(part_to_remove), 1); // remove the closest match so it doesn't get used again
		}
		let multiplier = 1;
		if (LEE_segments[partInput]) {
			multiplier = 1 / (LEE_segments[partInput] ** LEE_config.weights.segmentPower); // this number decreases with number of occurrences of a given word
		}
		combined_part_distance += lowest_part_distance * multiplier;
	}
	return combined_part_distance * LEE_config.weights.partMultiplier + distance * LEE_config.weights.distanceMultiplier;
}

function LEE_handle_suggestion(original_input, closest_key) {
	let best_key = LEE_index_from_string(closest_key);
	if (LEE_DEBUG_MODE) {
		LEE_print_debug_error(`Computing closest match for key ${closest_key}`, LEE_css_selectors.debug);
	}
	let closest_match = null;
	let cost = null;
	for (const key of best_key["match"]) {
		let new_cost = LEE_lev.levenshtein(key, original_input);
		if (cost === null || new_cost < cost) {
			cost = new_cost;
			closest_match = key;
		}
	}
	let reply = `${LEE_config.undefinedMessage} ${LEE_config.suggestionMessage}\n${closest_match}`;
	LEE_construct_message(LEE_config.leeName, reply);
	LEE_scroll_down();
}

// - - - match reply - - -
async function LEE_reply_from_key(key, previousKey = null) {
	const rule = LEE_index_from_string(key);
	let reply = null;
	reply ??= LEE_module_exists(rule);
	reply ??= LEE_module_random(rule);
	reply ??= LEE_module_sequence(rule);
	reply ??= await LEE_module_ref(rule, key, previousKey);
	if (reply !== null && rule !== undefined && !LEE_compare_array(reply, [undefined]) && !LEE_compare_array(reply, [null])) {
		return Array.isArray(reply) ? reply : [reply, key, rule["delay"], rule["encode"]];
	} else if (LEE_DEBUG_MODE && rule !== undefined && !LEE_compare_array(reply, [null])) {
		let prevkey_addition = ""; // used when the key is recursive
		if (previousKey) {
			prevkey_addition = `\n\nFrom key:\n${previousKey} : ${LEE_pretty_JSON(LEE_index_from_string(previousKey))}`;
		}
		LEE_print_debug_error(`No response defined for key\n${key} : ${LEE_pretty_JSON(LEE_index_from_string(key))}${prevkey_addition}`);
		return [null];
	}
	return reply;
}

function LEE_module_exists(rule) {
	if (rule !== undefined) {
		return null;
	}
	return [undefined];
}

function LEE_module_random(rule) {
	if (rule["response"] !== null && rule["random"]) {
		return rule["response"][LEE_randint(0, rule["response"].length - 1)];
	}
	return null;
}

function LEE_module_sequence(rule) {
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

async function LEE_module_ref(rule, key, previousKey) {
	if (rule["ref"] !== null) {
		let new_key = rule["ref"];
		if (new_key.includes("this.")) { // if in the same subkey, take the original key, remove the lowest level key and then append everything after "this."
			new_key = key.substring(0, key.lastIndexOf(".") + 1) + new_key.replace("this.", "");
		}
		if (previousKey === key) { // would recurse until infinity (or until the stack runs out of space)
			if (LEE_DEBUG_MODE) {
				LEE_print_debug_error(`Recursion detected.\n${key} : ${LEE_pretty_JSON(LEE_index_from_string(key))}`);
			}
			return [null];
		}
		if (previousKey === null) {
			previousKey = key; // set up recursion safety
		}
		return await LEE_reply_from_key(new_key, previousKey); // recurse to resolve new key
	}
	return null;
}

function LEE_index_from_string(responseKey) {
	if (!responseKey) {
		return undefined;
	}
	if (responseKey.indexOf("rules.") === 0) {
		responseKey = responseKey.replace("rules.", "");
	}
	const subkeys = responseKey.split(".");
	let current_object = LEE_responses;
	for (const key of subkeys) {
		if (current_object && current_object[key]) {
			current_object = current_object[key]; // resolve key
		} else {
			if (LEE_DEBUG_MODE) {
				LEE_print_debug_error(`Key "${responseKey}" does not exist.`);
			}
			return undefined; // the supplied key does not exist, return undefined and let calling function handle
		}
	}
	return current_object;
}

function LEE_check_context(input) {
	if (!LEE_previous_key) { return false; }
	const previousRule = LEE_index_from_string(LEE_previous_key);
	if (previousRule["response"] && previousRule["response"].length > 1) {
		let cost = null;
		for (const context of previousRule["context"]) {
			let new_cost = LEE_calculate_cost(context, input);
			if (cost === null || new_cost < cost) {
				cost = new_cost;
			}
		}
		if (cost !== null && input.length * LEE_config.contextMargin > cost) {
			return true;
		}
	}
	return false;
}

// - - - commands - - -
function LEE_detect_command(input) {
	for (const command of LEE_commands) {
		if (input.split(" ")[0].includes(command)) { // detects commands only if they occur at the start
			return	true;
		}
	}
	return false;
}

function LEE_handle_command(input) {
	const command = input.split(" ")[0];
	switch (command) {
		case "!help":
		case "!commands":
			LEE_command_list_commands();
			break;
		case "!clear":
			LEE_command_clear();
			break;
		case "!reinit":
			LEE_command_reinit();
			break;
		case "!search":
			LEE_command_search(input);
			break;
	}
}

function LEE_command_list_commands() {
	let reply = `!commands       : shows this explanation
!clear          : removes all messages from the chatlog
!reinit         : reloads LeeConfig.json and resets all parameters to their initial values (debug mode required)
!search <query> : searches every message for the string <query>`;
	LEE_construct_message(LEE_config.leeName, reply, 300);
}

function LEE_command_clear() {
	LEE_chatlog_container.innerHTML = "";
}

function LEE_command_search(query) {
	for (const child of LEE_chatlog_container.children) {
		child.classList.remove(LEE_css_selectors.search); // remove from everything
	}
	let search_query = query.replace("!search", "").trim().toLowerCase();
	let children = Array.from(LEE_chatlog_container.children);
	children.forEach ((child, index) => {
		if (child.innerText.toLowerCase().includes(search_query) && index !== children.length - 1) { // only if innerText contains the search query and it is not the search query itself
			child.classList.add(LEE_css_selectors.search);
		}
	});
}

function LEE_command_reinit() {
	if (LEE_DEBUG_MODE) {
		// reset all attributes
		LEE_responses = null;
		LEE_matches = {};
		LEE_segments = {};
		LEE_history = [];
		LEE_history_index = 0;
		LEE_lock_wrapper(LEE); // call init function again
		LEE_scroll_down();
	}
}

// - - - IO - - -
function LEE_input_listener(event) {
	if (event.code === "Enter") {
		LEE_lock_wrapper(LEE_get_input);
	} else if (event.code === "ArrowUp") {
		event.preventDefault(); // would move caret to the left
		LEE_set_from_history(1);
	} else if (event.code === "ArrowDown") {
		event.preventDefault();
		LEE_set_from_history(-1);
	}
}

async function LEE_get_input() {
	let user_input = LEE_input.value;
	LEE_input.value = null;
	let treated_input = LEE_sanitize_input(user_input);
	if (treated_input === "" || treated_input === " ") {
		return;
	}
	LEE_add_to_history(user_input);
	await LEE_construct_message(LEE_config.userName, user_input); // show what user typed
	if (LEE_config.enableCommands && LEE_detect_command(treated_input)) {
		LEE_handle_command(treated_input);
		return;
	}
	let results;
	if (LEE_check_context(treated_input)) {
		results = await LEE_reply_from_key(LEE_previous_key);
	} else {
		const best_match = LEE_calculate_match(treated_input);
		if (best_match === -1) { return; }
		results = await LEE_reply_from_key(best_match);
	}
	let reply = results[0];
	LEE_previous_key = results[1];
	let delay = results[2];
	const encode = results[3];
	if ((reply === undefined || reply === null) && LEE_config.undefinedMessage !== null) {
		reply = LEE_config.undefinedMessage;
	}
	if (reply) {
		if (delay === undefined || delay === null) {
			delay = LEE_randint(LEE_config.randomInterval[0], LEE_config.randomInterval[1]);
		}
		await LEE_construct_message(LEE_config.leeName, reply, delay, encode);
	} else {
		if (LEE_DEBUG_MODE) {
			LEE_print_debug_error(`Expected a message, but got an empty reply from key\n${LEE_previous_key} : ${LEE_pretty_JSON(LEE_index_from_string(LEE_previous_key))}`, LEE_css_selectors.warning);
		}
	}
	LEE_scroll_down();
}

function LEE_sanitize_input(message, lower = true) {
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

async function LEE_construct_message(from, message, delay = 0, encode = false) {
	if (!message) { return; }
	const from_user = from === LEE_config.userName;
	const chatlog_msg_container = document.createElement("div");
	const msg_identifier = document.createElement("div");
	const msg_container = document.createElement("div");
	if (from) {
		chatlog_msg_container.appendChild(msg_identifier);
	}
	chatlog_msg_container.appendChild(msg_container);

	chatlog_msg_container.classList = LEE_css_selectors.chatlog_msg_container + " " + (from_user ? LEE_css_selectors.usr_msg_container : LEE_css_selectors.self_msg_container);
	// if from user use user background color else use lee background color
	msg_identifier.classList = LEE_css_selectors.msg_identifier + " " + LEE_css_selectors.no_select;
	msg_identifier.innerText = from;

	msg_container.classList = LEE_css_selectors.msg_container + " " + LEE_css_selectors.selection;
	if (encode) { // <a> links and other html elements
		msg_container.innerHTML = message;
	} else {
		msg_container.innerText = message;
	}

	await LEE_sleep(delay);
	LEE_chatlog_container.appendChild(chatlog_msg_container);
	LEE_scroll_down();
	return chatlog_msg_container; // return to potentially apply more styling to the container
}

async function LEE_print_debug_error(msg, severity = LEE_css_selectors.error) {
	const debug_msg = await LEE_construct_message(LEE_config.debugName, msg);
	debug_msg.classList.add(severity);
}


function LEE_add_to_history(item) {
	if (LEE_history[0] !== item) {
		LEE_history.unshift(item);
	}
	LEE_history_index = -1;
}

function LEE_set_from_history(index) {
	if (LEE_history_index + index === -1) {
		LEE_history_index = -1;
		LEE_input.value = null;
	}
	if (LEE_history_index + index > -1 && LEE_history_index + index < LEE_history.length) {
		LEE_history_index += index;
	}
	if (LEE_history[LEE_history_index]) {
		LEE_input.value = LEE_history[LEE_history_index];
	}
	LEE_input.setSelectionRange(LEE_input.value.length, LEE_input.value.length);
}

function LEE_scroll_down() {
	LEE_chatlog_container.scrollTop = LEE_chatlog_container.scrollHeight;
}

// - - - IO blocking - - -
function LEE_obtain_lock() {
	LEE_input.disabled = true;
	LEE_input.classList.add(LEE_css_selectors.lock);
}

function LEE_discard_lock() {
	LEE_input.disabled = false;
	LEE_input.classList.remove(LEE_css_selectors.lock);
	LEE_input.focus();
}

async function LEE_lock_wrapper(func, ...args) {
	LEE_obtain_lock();
	await func(...args); // no inputs permitted during function call
	LEE_discard_lock();
}

// - - - utility - - -
function LEE_compare_array(a1, a2) {
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

function LEE_pretty_JSON(msg) {
	return JSON.stringify(msg, null, 4);
}

function LEE_remove_symbols(str) {
	return str.replace(/[^a-zA-Z0-9 ]/g, ""); // select everything a-z A-Z 0-9 and whitespace, ^ inverts everything -> removes everything not in the previously selected, /g is for all occurrences
}

/*
title: What is the JavaScript version of sleep()?
author: Dan Dascalescu
date: 06.03.2022
source: https://stackoverflow.com/a/39914235
*/
function LEE_sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

/*
title: Math.random()
date: 14.03.2022
source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values_inclusive
*/
function LEE_randint(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}