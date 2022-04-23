
const LEE_DEBUG_MODE = true; // make this true to print debug messages
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
	debug: "lee__debug__message",
	selection: "lee__selection",
};
const LEE_config_file_name = "./LeeAssets/config/LeeConfig.json";
const LEE_config = {};
const LEE_commands = ["!commands", "!help", "!clear", "!reinit", "!search"];
// eslint-disable-next-line no-undef
const lev = new js_levenshtein();
let LEE_responses;
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
	let LEE_data;
	try {
		LEE_data = await ( await fetch(LEE_config_file_name) ).json();
	} catch (error) {
		LEE_config.debugName = "[DEBUG]: ";
		LEE_print_debug_error(`Error while reading ${LEE_config_file_name}:\n${error}.\nExecution halted.`);
		throw error;
	}
	for (const key in LEE_data.config) {
		LEE_config[key] = LEE_data.config[key];
	}
	LEE_responses = LEE_data.rules;
}

function LEE_sanitize_data() {
	for (const topic in LEE_responses) {
		for (const rule in LEE_responses[topic]) {
			for (const key of LEE_config.attributes) {
				if (!(key in LEE_responses[topic][rule])) {
					let LEE_default = null;
					switch(key) { // initialize non-existent keys
						case "counter":
							LEE_default = 0;
							break;
						case "random":
						case "encode":
							LEE_default = false;
							break;
					}
					LEE_responses[topic][rule][key] = LEE_default;
				}
			}
			for (const key of ["match", "response"]) { // transform to array to make indexing, counting and referring easier
				if (typeof(LEE_responses[topic][rule][key]) === "string") {
					LEE_responses[topic][rule][key] = [LEE_responses[topic][rule][key]];
				}
			}
			if (LEE_responses[topic][rule]["match"]) { // construct rule to key mapping
				const LEE_match = LEE_responses[topic][rule]["match"];
				const LEE_match_key = `${topic}.${rule}`;
				for (let match of LEE_match) {
					let original_match = match;
					match = match.toLowerCase();
					if (!LEE_matches[match]) {
						LEE_matches[match] = LEE_match_key;
					} else {
						if (LEE_DEBUG_MODE) {
							LEE_print_debug_error(`Match "${original_match}" of ${LEE_match_key} is already used in ${LEE_matches[match]}`);
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
	let LEE_max_name_len = 0;
	for (const key in LEE_config) { // compute max length of all names
		if (key.includes("Name")) {
			if (key.includes("debug")) { // only include debug if DEBUG_MODE is true, otherwise names could be unnecessarily long
				if (LEE_DEBUG_MODE) {
					LEE_max_name_len = Math.max(LEE_max_name_len, LEE_config[key].length + 1);
				}
			} else {
				LEE_max_name_len = Math.max(LEE_max_name_len, LEE_config[key].length + 1);
			}
		}
	}
	for (const key in LEE_config) { // set all to equal max length
		if (key.includes("Name")) {
			const LEE_length_diff = Math.abs(LEE_max_name_len - LEE_config[key].length); // get difference between max and name length
			LEE_config[key] += String.fromCharCode(160).repeat(LEE_length_diff); // &nbsp
		}
	}
}

// - - - match calculation - - -
function LEE_calculate_match(input) {
	let LEE_cost = null;
	let LEE_best_key = null;
	let LEE_second_best_key;
	for (const key in LEE_matches) {
		let LEE_new_cost = LEE_calculate_cost(key, input); // iterate through every key
		if (LEE_cost === null || LEE_new_cost < LEE_cost) { // only set it new cost is less than previous best cost
			LEE_cost = LEE_new_cost;
			LEE_second_best_key = LEE_matches[key];
			LEE_best_key = LEE_matches[key];
			if (LEE_DEBUG_MODE) {
				LEE_print_debug_error(`Best cost is ${LEE_cost} with key "${key}" from rule ${LEE_matches[key]}`, LEE_css_selectors.debug);
			}
		}
		if (LEE_cost === 0) { // exact match, short-circuit
			return LEE_best_key;
		}
	}
	if (input.length * LEE_config.suggestionRange[0] <= LEE_cost && LEE_cost <= input.length * LEE_config.suggestionRange[1]) {
		LEE_handle_suggestion(input, LEE_second_best_key);
		return -1;
	} else if (input.length * LEE_config.errorMargin < LEE_cost) { // too many edits to be made with levenshtein algorithm, likely not a close match
		return null;
	}
	return LEE_best_key;
}

function LEE_calculate_cost(key, input) {
	key = key.toLowerCase();
	input = input.toLowerCase();
	const LEE_distance = lev.levenshtein(key, input);
	let LEE_key_segments = LEE_remove_symbols(key).split(" ");
	let LEE_input_segments = LEE_remove_symbols(input).split(" ");
	let LEE_part_to_remove = null;

	let LEE_combined_part_distance = 0;
	for (const partInput of LEE_input_segments) { // match each input segment to the closest rule segment
		let LEE_lowest_part_distance = null;
		for (const partKey of LEE_key_segments) {
			let LEE_part_distance = lev.levenshtein(partInput, partKey);
			if (LEE_lowest_part_distance === null || LEE_part_distance < LEE_lowest_part_distance) {
				LEE_lowest_part_distance = LEE_part_distance;
				LEE_part_to_remove = partKey;
			}
		}
		if (LEE_key_segments.length > 1) {
			LEE_key_segments.splice(LEE_key_segments.indexOf(LEE_part_to_remove), 1); // remove the closest match so it doesn't get used again
		}
		let LEE_multiplier = 1;
		if (LEE_segments[partInput]) {
			LEE_multiplier = 1 / (LEE_segments[partInput] ** LEE_config.weights.segmentPower); // this number decreases with number of occurrences of a given word
		}
		LEE_combined_part_distance += LEE_lowest_part_distance * LEE_multiplier;
	}
	return LEE_combined_part_distance * LEE_config.weights.partMultiplier + LEE_distance * LEE_config.weights.distanceMultiplier;
}

function LEE_handle_suggestion(original_input, closest_key) {
	let LEE_best_key = LEE_index_from_string(closest_key);
	if (LEE_DEBUG_MODE) {
		LEE_print_debug_error(`Computing closest match for key ${closest_key}`, LEE_css_selectors.debug);
	}
	let LEE_best_closest_match = null;
	let LEE_cost = null;
	for (const key of LEE_best_key["match"]) {
		let LEE_new_cost = lev.levenshtein(key, original_input);
		if (LEE_cost === null || LEE_new_cost < LEE_cost) {
			LEE_cost = LEE_new_cost;
			LEE_best_closest_match = key;
		}
	}
	let LEE_reply = `${LEE_config.undefinedMessage} ${LEE_config.suggestionMessage}\n${LEE_best_closest_match}`;
	LEE_construct_message(LEE_config.leeName, LEE_reply);
	LEE_scroll_down();
}

// - - - match reply - - -
async function LEE_reply_from_key(key, previousKey = null) {
	const LEE_cr = LEE_index_from_string(key);
	let LEE_reply = null;
	LEE_reply ??= LEE_module_exists(LEE_cr);
	LEE_reply ??= LEE_module_random(LEE_cr);
	LEE_reply ??= LEE_module_sequence(LEE_cr);
	LEE_reply ??= await LEE_module_ref(LEE_cr, key, previousKey);
	if (LEE_reply !== null && LEE_cr !== undefined && !LEE_compare_array(LEE_reply, [undefined]) && !LEE_compare_array(LEE_reply, [null])) {
		return previousKey === null ? [LEE_reply, LEE_cr["delay"], LEE_cr["encode"]] : LEE_reply;
	} else if (LEE_DEBUG_MODE && LEE_cr !== undefined && !LEE_compare_array(LEE_reply, [null])) {
		let LEE_prevkey_addition = ""; // used when the key is recursive
		if (previousKey) {
			LEE_prevkey_addition = `\n\nFrom Key: ${previousKey} : ${LEE_pretty_JSON(LEE_index_from_string(previousKey))}`;
		}
		LEE_print_debug_error(`No response defined for:\n${key} : ${LEE_pretty_JSON(LEE_index_from_string(key))}${LEE_prevkey_addition}`);
		return [null];
	}
	return LEE_compare_array(LEE_reply, [null]) ? [null] : [undefined];
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
		let LEE_new_key = rule["ref"];
		if (LEE_new_key.includes("this.")) { // if in the same subkey, take the original key, remove the lowest level key and then append everything after "this."
			LEE_new_key = key.substring(0, key.lastIndexOf(".") + 1) + LEE_new_key.replace("this.", "");
		}
		if (previousKey === key) { // would recurse until infinity (or until the stack runs out of space)
			if (LEE_DEBUG_MODE) {
				LEE_print_debug_error(`Recursion detected:\n${key} ${LEE_pretty_JSON(LEE_index_from_string(key))}`);
			}
			return [null];
		}
		if (previousKey === null) {
			previousKey = key; // set up recursion safety
		}
		return await LEE_reply_from_key(LEE_new_key, previousKey); // recurse to resolve new key
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
	const LEE_subkeys = responseKey.split(".");
	let LEE_current_object = LEE_responses;
	for (const key of LEE_subkeys) {
		if (LEE_current_object && LEE_current_object[key]) {
			LEE_current_object = LEE_current_object[key]; // resolve key
		} else {
			if (LEE_DEBUG_MODE) {
				LEE_print_debug_error(`Key "${responseKey}" does not exist.`);
			}
			return undefined; // the supplied key does not exist, return undefined and let calling function handle
		}
	}
	return LEE_current_object;
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
	let LEE_reply = `!commands       : shows this explanation
!clear          : removes all messages from the chatlog
!reinit         : reloads LeeConfig.json and resets all parameters to their initial values (debug mode required)
!search <query> : searches every message for the string <query>`;
	LEE_construct_message(LEE_config.leeName, LEE_reply, 300);
}

function LEE_command_clear() {
	LEE_chatlog_container.innerHTML = "";
}

function LEE_command_search(query) {
	for (const child of LEE_chatlog_container.children) {
		child.classList.remove(LEE_css_selectors.search); // remove from everything
	}
	let LEE_search_query = query.replace("!search", "").trim().toLowerCase();
	let LEE_children = Array.from(LEE_chatlog_container.children);
	LEE_children.forEach ((child, index) => {
		if (child.innerText.toLowerCase().includes(LEE_search_query) && index !== LEE_children.length - 1) { // only if innerText contains the search query and it is not the search query itself
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
	let LEE_user_input = LEE_input.value;
	LEE_add_to_history(LEE_user_input);
	LEE_input.value = null;
	let LEE_treated_input = LEE_sanitize_input(LEE_user_input);
	if (LEE_treated_input === "" || LEE_treated_input === " ") {
		return;
	}
	await LEE_construct_message(LEE_config.userName, LEE_user_input); // show what user typed
	if (LEE_config.enableCommands && LEE_detect_command(LEE_treated_input)) {
		LEE_handle_command(LEE_treated_input);
		return;
	}
	const LEE_best_match = LEE_calculate_match(LEE_treated_input);
	if (LEE_best_match === -1) { return; }
	const LEE_results = await LEE_reply_from_key(LEE_best_match);
	let LEE_reply = LEE_results[0];
	let LEE_delay = LEE_results[1];
	let LEE_encode = LEE_results[2];
	if ((LEE_reply === undefined || LEE_reply === null) && LEE_config.undefinedMessage !== null) {
		LEE_reply = LEE_config.undefinedMessage;
	}
	if (LEE_reply) {
		if (LEE_delay === undefined || LEE_delay === null) {
			LEE_delay = LEE_randint(LEE_config.randomInterval[0], LEE_config.randomInterval[1]);
		}
		await LEE_construct_message(LEE_config.leeName, LEE_reply, LEE_delay, LEE_encode);
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
	const LEE_from_user = from === LEE_config.userName;
	const LEE_chatlog_msg_container = document.createElement("div");
	const LEE_msg_identifier = document.createElement("div");
	const LEE_msg_container = document.createElement("div");
	if (from) {
		LEE_chatlog_msg_container.appendChild(LEE_msg_identifier);
	}
	LEE_chatlog_msg_container.appendChild(LEE_msg_container);

	LEE_chatlog_msg_container.classList = LEE_css_selectors.chatlog_msg_container + " " + (LEE_from_user ? LEE_css_selectors.usr_msg_container : LEE_css_selectors.self_msg_container);
	// if from user use user background color else use lee background color
	LEE_msg_identifier.classList = LEE_css_selectors.msg_identifier + " " + LEE_css_selectors.no_select;
	LEE_msg_identifier.innerText = from;

	LEE_msg_container.classList = LEE_css_selectors.msg_container + " " + LEE_css_selectors.selection;
	if (encode) { // <a> links and other html elements
		LEE_msg_container.innerHTML = message;
	} else {
		LEE_msg_container.innerText = message;
	}

	await LEE_sleep(delay);
	LEE_chatlog_container.appendChild(LEE_chatlog_msg_container);
	LEE_scroll_down();
	return LEE_chatlog_msg_container; // return to potentially apply more styling to the container
}

async function LEE_print_debug_error(msg, severity = LEE_css_selectors.error) {
	const LEE_debug_msg = await LEE_construct_message(LEE_config.debugName, msg);
	LEE_debug_msg.classList.add(severity);
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