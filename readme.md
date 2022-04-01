# Language-Expression-Evaluator
Lee is a fully configurable chatbot that can be easily integrated into your website.

## Installing
Copy `./LeeAssets/` and `LICENSE` to the directory that contains the `.html` file you want to add the chatbot to. For the chatbot to work you need to provide `<div id="lee__chatlog__container"></div>` along with `<input id="lee_input" type="text">`. You should also include everything from `LEE_css_selectors` in your CSS file. [`index.html`](./index.html) provides an example layout but you are free to modify it to fit your specific needs.

If you use the included CSS files you will likely need to adjust the positioning of the `container` in `style.css`.

## Running
This bot uses the `fetch` API and as such cannot be run using the `file` protocol. It requires some kind of server to operate, for example the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension for VS Code.

## Configuration
To change the behavior of the bot you need to modify [`./LeeAssets/config/LeeConfig.json`](./LeeAssets/config/LeeConfig.json). An example config file can be found at [`./LeeAssets/config/configExample.json`](./LeeAssets/config/configExample.json).

### config { }
```json
"config" : {
    "leeName" : "LEE:",
    "userName" : "User:",
    "debugName" : "[DEBUG]:",
    "initMsg" : "Hi! My name is Lee and I have some cool functionality. Use !commands to show special actions.",
    "initMsgDelay" : 300,
    "attributes" : ["match", "response", "ref", "random", "delay", "counter"],
    "undefinedMessage" : "I unfortunately do not understand you.",
    "errorMargin" : 1.2,
    "suggestionRange" : [1.2, 1.4],
    "suggestionMessage" : "Did you mean:",
    "enableCommands" : true,
    "randomInterval" : [300, 500],
    "weights" : {
        "segmentPower" : 2,
        "distanceMultiplier" : 1,
        "partMultiplier" : 1.5
    }
}
```
`leeName`, `userName` and `debugName` are strings that specify the names of the bot itself, the user and the debug messages. They will appear before every message. The bot automatically adds characters to make the names an equal length.

`initMsg` is the message the bot will automatically send on startup after a delay of `initMsgDelay` (specified in ms).

`attributes` contains all keys a rule can have, you can extend this with your own custom keys. For each rule every element of this array will get initialized to `null` (`0` for `counter`, `false` for `random` and `encode`) if it is not present. Deleting any element will likely result in errors.

`undefinedMessage` is the message the bot will send if it is unsure of what to answer. This is determined using the `errorMargin` value you can read more about [here](#unknown-replies).

`suggestionRange` is an array of length 2 that holds the multipliers for the suggestion matching. If the final cost value is within this range, the closest match will suggested. `suggestionMessage` will be displayed above the closest match.

`enableCommands` enables or disables [commands](#commands).

`randomInterval` is an array of length 2 that specifies the interval for random delays (in ms). The bot will add a delay of this range before every reply if the rule does not have the `delay` attribute set. If there should be no standard interval, set both values to `0`.

`weights` is used in cost calculation. Its properties are explained [here](#cost-calculation).

### rules { }
```json
"rules" : {
    "categoryIdentifier" : {
        "ruleIdentifier" : {
            "match"    : "either a single string or an array [] of strings",
            "response" : "either a single string or an array [] of strings",
            "ref"      : "a redirect to another rule",
            "random"   : "bool, specifies whether to pick a random entry from the response array []",
            "delay"    : "float, specifies for how long to wait before sending the response",
            "encode"   : "bool, specifies whether response should be interpreted as text or as HTML"
        }
    }
}
```
`categoryIdentifier` and `ruleIdentifier` must be unique.

The `match` attribute specifies what keywords or sentences trigger its rule. It can either be a single string `"Example match"`, or an array with multiple entries `["Example match 1", "Example match 2"]` (The single string is converted to an array internally so using an array with only one entry is also fine). Each entry will trigger its rule regardless of how many entries there are. This can be used to broaden the search-space for a rule, for example if the rule should match `XYZ` the array could look like `["XYZ", "What is XYZ?", "What does XYZ do?"]`. Rules and input are converted to lowercase before evaluation. <br>__All matches must be unique and will throw a debug error if they are not__.

The `response` attribute specifies what the bot will answer when a given rule is triggered. It works the same as the `match` attribute in terms of type and entries. The array will be used in sequence each time the rule is triggered. Example array: `["Response 1", "Response 2", "Response 3"]`, when the rule is triggered for the first time the bot will respond with `Response 1`, on the second trigger it will respond with `Response 2` and so on. If there aren't any new responses remaining the last entry will be repeated. If `random` is `true`, then one of the entries will be chosen at random. The `delay` attribute (in ms) specifies for how long the bot will pause before sending the message. This can be used to simulate a processing time.

The `ref` attribute redirects to another rule. If the origin rule has no `response` the redirect is carried out on rule trigger. If there is a `response` the redirect is carried out after the end of the array has been reached. If `random` is `true` a redirect is not possible. `ref` takes the format of `categoryIdentifier.ruleIdentifier`. Should the rule be in the same category `categoryIdentifier` can be shortened to `this` (`this.ruleIdentifier`).

Infinite recursive loops are not permitted. 
```json
"rules" : {
    "categoryIdentifier" : {
        "exampleRule1" : {
            "match" : "Example match 1",
            "ref" : "this.exampleRule2"
        },
        "exampleRule2" : {
            "match" : "Example match 2",
            "ref" : "this.exampleRule1"
        }
    }
}
```
This will abandon the answering attempt and throw a debug error. This behavior is detected across all lengths of chains and across all categories.

`encode` specifies whether the response text will be interpreted as text or as HTML. This can be used to include links with `<a href=""></a>`, include other HTML elements or apply custom styling to certain text elements (use non-standard tags if the layout breaks).

`counter` should not be configured in the config file and is instead initialized to `0`. It is used to keep track of the current array index.

## Cost calculation
The bot uses the [Levenshtein](#packages) algorithm to determine the best match for a given input. The cost value is calculated in two stages. First the general distance is calculated and multiplied by `config.weights.distanceMultiplier`.<br>
For the second part the input and rule are split into their parts along every whitespace. The closest match between a segment from the input and a segment from the rule is calculated. The cost is then multiplied by `1 / (numberOfOccurrences ** config.weights.segmentPower)`. `numberOfOccurrences` is calculated on start-up by counting each word in the rule set. This is used to weigh uncommon words more and decrease the influence of more common words.<br>
Finally, the part value is multiplied by `config.weights.partMultiplier` and added to the previously calculated general distance value.

### Unknown replies
The input length is multiplied by `config.errorMargin`. If the resulting value is less than the cost, the input is considered unanswerable, since a lot more edits would have to be made to the rule and the words likely do not match at all. Increasing `config.errorMargin` may result in less genuine rules failing, but false-matches may occur more often.

Using the `suggestionRange`, close enough matches can display a message with a suggestion for the correct rule. The message is constructed in the format of `undefinedMessage` + `suggestionMessage` + `\n` + `closest match`.

## Commands
Lee features built-in commands that are called with the `!` prefix.<br>
`!commands` and `!help` show all available commands.<br>
`!clear` removes all messages from the chatlog.<br>
`!reinit` initializes the bot again, reloading `LeeConfig.json` and resets all settings according to the new file.
This can be used in rule writing to edit the config on the fly without having to reload the page.<br>
(This feature is only available when debug mode is enabled, as it could be exploited and cause unnecessary strain on the origin server.)<br>
`!search <query>` searches all chatlog messages (except itself) for the given query and highlights them by adding `lee__search__highlight` to their `classList`.

New custom commands should be lowercase, otherwise they will not be recognized.

## Debug Mode
If `LEE_DEBUG_MODE` at the top of `script.js` is set to `true`, the bot will send debug messages when various events occur. During cost calculation the bot will display the best cost value it has found so far. It will also warn about duplicate matches, non-existent keys, undefined responses and infinite `ref` loops. If you want to create your own debug messages call `LEE_print_debug_error(msg, severity)`, with severity being either `null` for `lee__error_message` or another CSS class to apply custom styling (such as with `lee__debug__message`).

## Packages
This project uses functions from [js-levenshtein](https://github.com/gustf/js-levenshtein). Even though it is available as a [npm package](https://www.npmjs.com/package/js-levenshtein), the functions were included in the source code to avoid using `require`or `import` as this project is meant to be runnable standalone. The function names were modified to fit the naming scheme and `var` was changed to `let` to avoid variable name collisions. All credit for this code goes to [Gustaf Andersson](https://github.com/gustf).