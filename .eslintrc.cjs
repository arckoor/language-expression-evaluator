// eslint-disable-next-line
module.exports = {
	parser: "@typescript-eslint/parser",
	parserOptions: {
		extraFileExtensions: [".svelte"]
	},
	env: {
		browser: true,
		node: true
	},
	extends: [
		"eslint:recommended",
		"plugin:svelte/recommended"
	],
	overrides: [
		{
			files: ["*.svelte"],
			parser: "svelte-eslint-parser",
			parserOptions: {
				parser: "@typescript-eslint/parser"
			}
		}
	],
	ignorePatterns: [
		"dist/"
	],
	rules: {
		"indent": [
			"error",
			"tab",
			{ "SwitchCase": 1 }
		],
		"linebreak-style": [
			"error",
			"unix"
		],
		"brace-style": [
			"error",
			"1tbs",
			{ "allowSingleLine": true }
		],
		"quotes": [
			"error",
			"double"
		],
		"semi": [
			"error",
			"always"
		],
		"space-before-function-paren": [
			"error",
			{
				"anonymous": "never",
				"named": "never",
				"asyncArrow": "always"
			}
		],
		"no-return-assign": "off",
		"object-curly-spacing": [
			"error",
			"always"
		],
		"curly": [
			"error",
			"multi-line",
			"consistent"
		],
		"comma-spacing": [
			"error"
		],
		"array-bracket-spacing": [
			"error",
			"never"
		],
		"space-before-blocks": [
			"error",
			"always"
		],
		"block-spacing": [
			"error",
			"always"
		],
		"no-trailing-spaces": [
			"error"
		],
		"eol-last": [
			"error"
		],
		"no-multiple-empty-lines": [
			"error",
			{
				"max": 2,
				"maxBOF": 0,
				"maxEOF": 1
			}
		],
		"no-multi-spaces": [
			"error",
			{
				"exceptions": {
					"VariableDeclarator": true,
					"ImportDeclaration": true,
					"Property": true
				}
			}
		]
	},
};
