import { setupHooks } from "./config.js";
import { PatrolApp } from "./app/PatrolApp.js";
import { registerSettings } from "./settings.js";
import { init } from "./app/PatrolApp.js";

import "../style/module.scss";

export const MODULE_ID = "patrol";

Hooks.on("init", () => {
    registerSettings();
});

Hooks.on("ready", () => {
    init();
});

setupHooks();