# Language-Expression-Evaluator
This project was originally made in my school time and written in (horrendous) vanilla JavaScript.
This version is a refactor using TypeScript and Svelte, and it tries to at least make a somewhat consistent use of types and best practices.

## What does it do?
LEE is a ChatBot with keyword rules, although it doesn't use pattern matching, instead relying on string distance algorithms like jaro-winkler. <br />
The rules are configurable in [/src/ts/config.ts](/src/ts/config.ts).
The default `config.ts` introduces all concepts that are available, and the type combined with the checks done in [/src/ts/parse.ts](/src/ts/parse.ts) should ensure you don't break anything.

## Areas that are interesting to look at
LEE doesn't accomplish any great tasks, but I did learn a lot about JS when I first made it. This rewrite uses large parts of the previous code, but it also separates areas of code and introduces new concepts entirely. <br />
- [queue.ts](/src/ts/queue.ts) is technically not a queue but a stack
- [history.ts](/src/ts/history.ts) implements the ability to press the up / down arrow to get the last inputs
- [parse.ts](/src/ts/parse.ts) parses the `config.ts` file __at build time__ instead of at runtime, abstracting much of the validation logic away from the runtime code
- [commands.ts](/src/ts/commands.ts) provides a couple of user commands to manipulate the `queue`
- [io.ts](/src/ts/io.ts) does the "heavy lifting", in that it evaluates user input and tries to find a reasonably good answer to the prompt
