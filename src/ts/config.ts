import type { Config } from "./types";

export default {
	config: {
		leeName: "LEE",
		userName: "User",
		initMsg: "Hi! My name is Lee and I have some cool functionality. Use !commands to show special actions.",
		initMsgDelay: 300,
		context: ["Can you explain further?", "What do you mean?", "Can you elaborate?", "I do not understand.", "What?", "How?", "Why?"],
		autoExtendContext: false,
		contextMargin: 0.8,
		undefinedMessage: "I unfortunately do not understand you.",
		errorMargin: 0.9,
		suggestionRange: {
			lbound: 0.7,
			ubound: 0.9
		},
		suggestionMessage: "Did you mean",
		enableCommands: true,
		randomInterval: {
			lbound: 100,
			ubound: 300
		},
	},
	rules: {
		exampleCategory: {
			exampleRule: {
				match: "Example match",
				response: ["Example response"],
				delay: 0,
				random: false,
				ref: undefined,
				encode: false,
				context: [],
				contextExtend: false
			},
			arrayMatchAndResponse: {
				match: ["array", "array match", "array response"],
				response: ["I", "have", "multiple", "responses", "!"]
			},
			randomResponse: {
				match: ["random", "randomness", "random answer"],
				response: ["1", "2", "3"],
				random: true
			},
			originResponse: {
				match: ["refer", "origin"],
				response: ["Repeat your input to get referred."],
				ref: "this.referredResponse"
			},
			referredResponse: {
				match: [""],
				response: ["You have been referred!"]
			},
			delayedResponse: {
				match: ["delay", "delayed response"],
				response: ["This response is very delayed."],
				delay: 5000
			},
			encodedResponse: {
				match: ["link", "encode"],
				response: ["This response is encoded to produce <a target=\"_blank\" href=\"https://github.com/arckoor/Language-Expression-Evaluator\">this</a> link."],
				encode: true
			},
			contextResponse: {
				match: ["context"],
				response: ["This rule contains only 'context' as match. So you should only be able to type that and trigger this rule. Try typing 'What?' however.", "As you can see, despite not being contained in the 'match' array, 'What?' triggers this rule, since it can be considered context for this question."],
				contextExtend: true
			}
		}
	}
} satisfies Config;
