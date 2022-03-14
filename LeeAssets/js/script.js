
const LEE_DEBUG_MODE = true; // make this true to print debug messages
const LEE_chatlog_container = document.getElementById("lee__chatlog__container");
const LEE_input = document.getElementById("lee_input");
const LEE_css_selectors = {
	lock:  "lee__input__disabled",
	chatlog_msg_container: "lee__chatlog__message__container",
	usr_msg_container: "lee__user__message__container",
	self_msg_contaimer: "lee__self__message__container",
	msg_identifier: "lee__message__identifier",
	no_select: "lee__no__select",
	msg_container: "lee__message__container",
	error: "lee__error__message",
	selection: "lee__selection"
};
const LEE_config_file_name = "./LeeAssets/config/LeeConfig.json";
const LEE_config = {
	leeName: null,
	userName: null,
	debugName: null,
	initMsg: null,
	initMsgDelay: null,
	attributes: null,
	undefinedMessage: null
};
let LEE_data;
let LEE_responses;
let LEE_history = [];
let LEE_history_index = 0;

LEE_lock_wrapper(LEE);

async function LEE() {
	LEE_obtain_lock();
	await LEE_load_config();
	LEE_sanitize_data();
	LEE_set_equal_name_length();
	if (LEE_config.initMsg !== undefined && LEE_config.initMsg != null) {
		await LEE_construct_message(LEE_config.leeName, LEE_config.initMsg, LEE_config.initMsgDelay);
	}
	LEE_discard_lock();
}

async function LEE_load_config() {
	LEE_data = await ( await fetch(LEE_config_file_name) ).json();
	for (const key in LEE_config) {
		LEE_config[key]= LEE_data.config[key];
	}
	LEE_responses = LEE_data.rules;
}

function LEE_pretty_JSON(msg) {
	return JSON.stringify(msg, null, 4);
}

function LEE_set_equal_name_length() {
	let LEE_max_name_len = 0;
	for (const key in LEE_config) { // compute max length of all names
		if (key.indexOf("Name") !== -1) {
			if (LEE_config[key]) {
				if (LEE_config[key].length > LEE_max_name_len) {
					if (key.indexOf("debug") !== -1) {
						if (LEE_DEBUG_MODE) { // only include debug if DEBUG_MODE is true, otherwise names could be unnecessarily long
							LEE_max_name_len = LEE_config[key].length;
						}
					} else {
						LEE_max_name_len = LEE_config[key].length;
					}
				}
			}
		}
	}
	for (const key in LEE_config) { // set all to equal max length
		if (key.indexOf("Name") !== -1) {
			if (LEE_config[key]) {
				const LEE_length_diff = Math.abs(LEE_max_name_len - LEE_config[key].length); // get difference between max and name length
				for (let i=0; i<LEE_length_diff; i++) {
					LEE_config[key] += String.fromCharCode(160); // &nbsp;
				}
			}
		}
	}
}

function LEE_sanitize_data() {
	for (const topic in LEE_responses) {
		for (const rule in LEE_responses[topic]) {
			for (const key of LEE_config.attributes) {
				if (key in LEE_responses[topic][rule]) {
					// do something
				} else {
					LEE_responses[topic][rule][key] = key === "counter" ? 0 : null;
				}
			}
			// transform to array to make indexing, counting and refering easier
			if (typeof(LEE_responses[topic][rule]["match"]) === "string") {
				LEE_responses[topic][rule]["match"] = [LEE_responses[topic][rule]["match"]];
			}
			if (typeof(LEE_responses[topic][rule]["response"]) === "string") {
				LEE_responses[topic][rule]["response"] = [LEE_responses[topic][rule]["response"]];
			}
		}
	}
}

function LEE_index_from_string(data, responseKey) {
	responseKey = responseKey.replace("rules.", "");
	const LEE_subkeys = responseKey.split(".");
	let LEE_current_object = data;
	for (const key of LEE_subkeys) {
		if (LEE_current_object) {
			LEE_current_object = LEE_current_object[key];
		} else {
			if (LEE_DEBUG_MODE) {
				LEE_print_debug_error(`Key "${responseKey}" does not exist.`);
				return undefined;
			}
		}
	}
	return LEE_current_object;
}

async function LEE_print_debug_error(msg) {
	const LEE_debug_msg = await LEE_construct_message(LEE_config.debugName, msg);
	LEE_debug_msg.classList.add(LEE_css_selectors.error);
}

async function LEE_reply_from_key(key, previousKey=null) {
	const LEE_cr = LEE_index_from_string(LEE_responses, key); // cr -> current_response
	let LEE_reply = null;
	let LEE_skip = false;
	if (LEE_cr !== undefined) {
		if (LEE_cr["response"] === null && LEE_cr["ref"] !== null) {
			LEE_skip = true; // no response(s), but there is a ref so immediately go there and skip everything else
		}
		if (LEE_cr["response"] !== null || LEE_skip) {
			if (!LEE_skip && LEE_cr["random"]) { // pick a random reponse
				const LEE_random_index = LEE_randint(0, LEE_cr["response"].length-1);
				LEE_reply = LEE_cr["response"][LEE_random_index];
			} else {
				if (!LEE_skip && LEE_cr["counter"] !== LEE_cr["response"].length) { // check if the counter is at the arrays last index
					LEE_reply = LEE_cr["response"][LEE_cr["counter"]];
					LEE_cr["counter"]++;
				} else {
					if (LEE_cr["ref"] !== null) { // at the end of the array, if there is a ref redirect there
						let LEE_new_key = LEE_cr["ref"];
						if (LEE_new_key.indexOf("this") !== -1) { // if in the same subkey, take the original key, remove the lowest level key and then append everything after "this."
							LEE_new_key = key.substring(0, key.lastIndexOf(".")+1) + LEE_new_key.replace("this.", "");
						}
						if (previousKey === key) { // would recurse until infinity (or until the stack runs out of space)
							if (LEE_DEBUG_MODE) {
								LEE_print_debug_error(`Recursion detected:\n${key} ${LEE_pretty_JSON(LEE_index_from_string(LEE_responses, key))}`);
							}
							return [undefined];
						}
						if (previousKey === null) {
							previousKey = key; // set up recursion safety
						}
						return await LEE_reply_from_key(LEE_new_key, previousKey); // recurse to resolve new key
					} else {
						LEE_reply = LEE_cr["response"][LEE_cr["counter"]-1]; // repeat the last entry the array has
					}
				}
			}
		}
	}
	if (LEE_reply !== null) {
		return [LEE_reply, LEE_cr["delay"]];
	}
	if (LEE_DEBUG_MODE) {
		let LEE_prevkey_addition = "";
		if (previousKey) {
			LEE_prevkey_addition = `\n\nFrom Key: ${previousKey} : ${LEE_pretty_JSON(LEE_index_from_string(LEE_responses, previousKey))}`;
		}
		LEE_print_debug_error(`No response defined for:\n${key} : ${LEE_pretty_JSON(LEE_index_from_string(LEE_responses, key))}${LEE_prevkey_addition}`);
	}
	return [undefined];
}

async function LEE_construct_message(from, message, delay=0) {
	const LEE_from_user = from === LEE_config.userName;
	const LEE_chatlog_msg_container = document.createElement("div");
	const LEE_msg_identifier = document.createElement("div");
	const LEE_msg_container = document.createElement("div");
	if (from) {
		LEE_chatlog_msg_container.appendChild(LEE_msg_identifier);
	}
	LEE_chatlog_msg_container.appendChild(LEE_msg_container);

	LEE_chatlog_msg_container.classList = LEE_css_selectors.chatlog_msg_container + " " + (LEE_from_user ? LEE_css_selectors.usr_msg_container : LEE_css_selectors.self_msg_contaimer);

	LEE_msg_identifier.classList = LEE_css_selectors.msg_identifier + " " + LEE_css_selectors.no_select;
	LEE_msg_identifier.innerText = from;

	LEE_msg_container.classList = LEE_css_selectors.msg_container + " " + LEE_css_selectors.selection;
	LEE_msg_container.innerText = message;

	await LEE_sleep(delay);
	LEE_chatlog_container.appendChild(LEE_chatlog_msg_container);
	LEE_scroll_down();
	return LEE_chatlog_msg_container;
}

function LEE_sanitize_input(message) {
	message = message.trim(); // remove trailing and preceeding spaces
	// https://stackoverflow.com/a/3286919
	message = message.replace(/\s\s+/g, " ").toLowerCase(); // remove multiple spaces
	return message;
}

async function LEE_get_input() {
	let LEE_user_input = LEE_input.value;
	LEE_add_to_history(LEE_user_input);
	LEE_input.value = null;
	let LEE_treated_input = LEE_sanitize_input(LEE_user_input);
	if (LEE_treated_input === "" || LEE_treated_input === " ") {
		return;
	}
	await LEE_construct_message(LEE_config.userName, LEE_user_input);
	// do something with the input here (reply with something)
	const LEE_results = await LEE_reply_from_key(LEE_user_input);
	let LEE_reply = LEE_results[0];
	let LEE_delay = LEE_results[1];
	if (LEE_reply === undefined && LEE_config.undefinedMessage !== null) {
		LEE_reply = LEE_config.undefinedMessage;
	}
	if (LEE_reply) {
		if (LEE_delay === undefined || LEE_delay === null) {
			LEE_delay = LEE_randint(300, 500);
		}
		await LEE_construct_message(LEE_config.leeName, LEE_reply, LEE_delay);
		// await LEE_construct_message(LEE_config.leeName, LEE_reply, 200+Math.floor(Math.random()*201)-100);
	}
	LEE_scroll_down();
}

function LEE_input_listener(event) {
	if (event.code === "Enter") {
		LEE_lock_wrapper(LEE_get_input);
	} else if (event.code === "ArrowUp") {
		LEE_set_from_history(1);
	} else if (event.code === "ArrowDown") {
		LEE_set_from_history(-1);
	}
}

LEE_input.addEventListener("keydown", LEE_input_listener);

function LEE_add_to_history(item) {
	LEE_history.unshift(item);
	LEE_history_index = -1;
}

function LEE_set_from_history(index) {
	if (LEE_history_index+index === -1) {
		LEE_history_index = -1;
		LEE_input.value = null;
	}
	if (LEE_history_index+index > -1 && LEE_history_index+index < LEE_history.length) {
		LEE_history_index += index;
	}
	if (LEE_history[LEE_history_index]) {
		LEE_input.value = LEE_history[LEE_history_index];
	}
}

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
	await func(...args);
	LEE_discard_lock();
}

function LEE_scroll_down() {
	LEE_chatlog_container.scrollTop = LEE_chatlog_container.scrollHeight;
}

// https://stackoverflow.com/a/39914235
function LEE_sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random#getting_a_random_integer_between_two_values_inclusive
function LEE_randint(min, max) {
	return Math.floor(Math.random()* (max - min + 1) + min);
}