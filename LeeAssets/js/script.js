
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
    selection: "lee__selection"
}
const LEE_config_file_name = "LeeConfig.json";
const LEE_config = {
    leeName: null,
    userName: null
}
let LEE_data;


async function LEE_load_config() {
    LEE_data = await ( await fetch(LEE_config_file_name) ).json()
    for (const key in LEE_config) {
        LEE_config[key]= LEE_data.config[key];
    }
    LEE_set_equal_name_length();
    console.log(LEE_config)
}

function LEE_set_equal_name_length() {
    const LEE_max_name_len = Math.max(LEE_config.leeName.length, LEE_config.userName.length);
    let LEE_length_diff = Math.abs(LEE_config.leeName.length - LEE_config.userName.length);
    for (let i=0; i<LEE_length_diff; i++) {
        if (LEE_config.leeName.length === LEE_max_name_len) {
            LEE_config.userName += String.fromCharCode(160);
        } else {
            LEE_config.leeName += String.fromCharCode(160);;
        }
    }
}

function LEE_construct_message(from, message) {
    const LEE_from_user = from === LEE_config.userName;
    const LEE_chatlog_msg_container = document.createElement("div");
    const LEE_msg_identifier = document.createElement("div");
    const LEE_msg_container = document.createElement("div");
    LEE_chatlog_msg_container.appendChild(LEE_msg_identifier);
    LEE_chatlog_msg_container.appendChild(LEE_msg_container);
    LEE_chatlog_container.appendChild(LEE_chatlog_msg_container);

    LEE_chatlog_msg_container.classList = LEE_classes.chatlog_msg_container + " " + (LEE_from_user ? LEE_classes.usr_msg_container : LEE_classes.self_msg_contaimer);
    
    LEE_msg_identifier.classList = LEE_classes.msg_identifier + " " + LEE_classes.no_select;
    LEE_msg_identifier.innerText = from;
    
    LEE_msg_container.classList = LEE_classes.msg_container + " " + LEE_classes.selection;
    LEE_msg_container.innerText = message;
    LEE_scroll_down();
}

function LEE_get_input() {
    LEE_obtain_lock();
    let LEE_user_input = LEE_input.value;
    if (LEE_user_input === "") {
        LEE_discard_lock();
        return;
    }
    LEE_input.value = null;
    // do something with the input here
    LEE_discard_lock();
    LEE_scroll_down();
}

function LEE_input_listener(event) {
    if (event.key === 'Enter') { 
        LEE_get_input(); 
    }
}

LEE_input.addEventListener("keypress", LEE_input_listener)

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