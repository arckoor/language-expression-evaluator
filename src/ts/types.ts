import { Users } from "./enums";

export type MessageItem = {
	fromName: string
	message: string
	fromType: number
	encode?: boolean
}

export type QueueItem = {
	fromName: string
	message: string
	fromType: Users
	maxLen: number
	encode: boolean
	highlight: boolean
}

export type Config = {
	config: CConfig,
	rules: {
		[x: string]: {
			[x: string]: Rule
		}
	}
}

export type CConfig = {
	leeName: string
	userName: string
	initMsg: string
	initMsgDelay: number,
	context: string[],
	autoExtendContext: boolean,
	contextMargin: number,
	undefinedMessage: string,
	errorMargin: number,
	suggestionRange: Range,
	suggestionMessage: string,
	enableCommands: boolean,
	randomInterval: Range
}

export type Range = {
	lbound: number,
	ubound: number
}

export type Rules = {
	[x: string]: {
		[x: string]: ProcessedRule
	}
}

export type Rule = {
	match?: string | string[]
	response: string[]
	ref?: string
	delay?: number
	random?: boolean
	encode?: boolean
	context?: string[]
	contextExtend?: boolean
}

export type ProcessedRule = {
	match: string[]
	response: string[]
	ref?: string
	delay?: number
	random: boolean
	encode: boolean
	context: string[]
	contextExtend: boolean
	counter: number
}
