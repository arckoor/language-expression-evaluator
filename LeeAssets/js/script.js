
const LEE_DEBUG_MODE = true;
const LEE_chatlog_container = document.getElementById("lee__chatlog__container");
const LEE_input = document.getElementById("lee_input");
const LEE_classes = {
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
	attributes: null
};
let LEE_data;
let LEE_responses;

LEE();

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
			if (LEE_config[key] !== undefined) {
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
			if (LEE_config[key] !== undefined) {
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
			if (typeof(LEE_responses[topic][rule]["match"]) === "string") {
				LEE_responses[topic][rule]["match"] = [LEE_responses[topic][rule]["match"]];
			}
			if (typeof(LEE_responses[topic][rule]["response"]) === "string") {
				LEE_responses[topic][rule]["response"] = [LEE_responses[topic][rule]["response"]];
			}
			if (LEE_DEBUG_MODE) {
				LEE_construct_message(LEE_config.debugName, rule + " " + LEE_pretty_JSON(LEE_responses[topic][rule]));
			}
		}
	}
	console.log(LEE_responses);
}

function LEE_index_from_string(data, responseKey) {
	const LEE_subkeys = responseKey.split(".");
	let LEE_current_object = data;
	for (const key of LEE_subkeys) {
		LEE_current_object = LEE_current_object[key];
	}
	return LEE_current_object;
}

async function LEE_print_debug_error(msg) {
	const LEE_debug_msg = await LEE_construct_message(LEE_config.debugName, msg);
	LEE_debug_msg.classList.add(LEE_classes.error);
}

async function LEE_reply_from_key(key, previousKey=null) {
	const LEE_cr = LEE_index_from_string(LEE_responses, key); // cr -> current_response
	let LEE_reply = null;
	let LEE_skip = false;
	if (LEE_cr !== undefined) {
		if (LEE_cr["response"] === null && LEE_cr["ref"] !== null) {
			LEE_skip = true;
		}
		if (LEE_cr["response"] !== null || LEE_skip) {
			if (!LEE_skip && LEE_cr["random"]) { // pick a random reponse
				const LEE_random_index = Math.floor(Math.random() * (LEE_cr["response"].length));
				LEE_reply = LEE_cr["response"][LEE_random_index];
			} else {
				if (!LEE_skip && LEE_cr["counter"] !== LEE_cr["response"].length) { // check if the counter is at the arrays last index
					LEE_reply = LEE_cr["response"][LEE_cr["counter"]];
					LEE_cr["counter"]++;
				} else {
					if (LEE_cr["ref"] !== null) { // at the end of the array, if there is a ref redirect there
						let LEE_new_key = LEE_cr["ref"];
						if (LEE_new_key.indexOf("this") !== -1) { // if in same subkey, take original key and append everything after this.
							LEE_new_key = key.substring(0, key.lastIndexOf(".")+1) + LEE_new_key.replace("this.", "");
						}
						if (previousKey === key) { // will recurse until infinity (or until the stack runs out of space)
							if (LEE_DEBUG_MODE) {
								LEE_print_debug_error(`Recursion detected:\n${key} ${LEE_pretty_JSON(LEE_index_from_string(LEE_responses, key))}`);
							}
							return;
						}
						if (previousKey === null) {
							previousKey = key; // set up recursion safety
						}
						return LEE_reply_from_key(LEE_new_key, previousKey); // recurse to resolve new key
					} else {
						LEE_reply = LEE_cr["response"][LEE_cr["counter"]-1]; // repeat the last entry the array has
					}
				}
			}
		}
	}
	if (LEE_reply !== null) {
		return LEE_reply;
	}
	if (LEE_DEBUG_MODE) {
		LEE_print_debug_error(`No response defined for:\n${key} : ${LEE_pretty_JSON(LEE_index_from_string(LEE_responses, key))}`);
	}
	return;
}


async function LEE_construct_message(from, message, delay=0) {
	const LEE_from_user = from === LEE_config.userName;
	const LEE_chatlog_msg_container = document.createElement("div");
	const LEE_msg_identifier = document.createElement("div");
	const LEE_msg_container = document.createElement("div");
	LEE_chatlog_msg_container.appendChild(LEE_msg_identifier);
	LEE_chatlog_msg_container.appendChild(LEE_msg_container);

	LEE_chatlog_msg_container.classList = LEE_classes.chatlog_msg_container + " " + (LEE_from_user ? LEE_classes.usr_msg_container : LEE_classes.self_msg_contaimer);

	LEE_msg_identifier.classList = LEE_classes.msg_identifier + " " + LEE_classes.no_select;
	LEE_msg_identifier.innerText = from;

	LEE_msg_container.classList = LEE_classes.msg_container + " " + LEE_classes.selection;
	LEE_msg_container.innerText = message;

	await LEE_sleep(delay);
	LEE_chatlog_container.appendChild(LEE_chatlog_msg_container);
	LEE_scroll_down();
	return LEE_chatlog_msg_container;
}

function LEE_sanitize_input(message) {
	// https://stackoverflow.com/a/3286919
	message = message.trim(); // remove trailing and preceeding spaces
	message = message.replace(/\s\s+/g, " ").toLowerCase(); // remove multiple spaces
	return message;
}

async function LEE_get_input() {
	LEE_obtain_lock();
	let LEE_user_input = LEE_input.value;
	LEE_input.value = null;
	let LEE_treated_input = LEE_sanitize_input(LEE_user_input);
	if (LEE_treated_input === "" || LEE_treated_input === " ") {
		LEE_discard_lock();
		return;
	}
	await LEE_construct_message(LEE_config.userName, LEE_user_input);
	// do something with the input here (reply with something)
	await LEE_construct_message(LEE_config.leeName, "LEE replies with: " + LEE_treated_input, 200+Math.floor(Math.random()*201)-100);
	LEE_discard_lock();
	LEE_scroll_down();
}

function LEE_input_listener(event) {
	if (event.key === "Enter") {
		LEE_get_input();
	}
}

LEE_input.addEventListener("keypress", LEE_input_listener);

function LEE_obtain_lock() {
	LEE_input.disabled = true;
	LEE_input.classList.add(LEE_classes.lock);
}

function LEE_discard_lock() {
	LEE_input.disabled = false;
	LEE_input.classList.remove(LEE_classes.lock);
	LEE_input.focus();
}

function LEE_scroll_down() {
	LEE_chatlog_container.scrollTop = LEE_chatlog_container.scrollHeight;
}

// https://stackoverflow.com/a/39914235
function LEE_sleep(ms) {
	return new Promise(r => setTimeout(r, ms));
}

