import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath, URL } from "url";

import configParser from "./src/ts/parse";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		configParser(),
		svelte()
	],
	resolve: {
		extensions: [".ts", ".css"],
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url))
		}
	},
});
