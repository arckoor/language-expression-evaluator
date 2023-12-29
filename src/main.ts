import "./app.css";
import app from "./app.svelte";

// @ts-ignore
export default new app({
	target: document.getElementById("app") as HTMLElement
});
