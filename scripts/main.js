import { setupHooks } from "./config.js";
import { Patrol } from "./app/Patrol.js";
import { PatrolApp } from "./app/PatrolApp.js";
import { registerSettings } from "./settings.js";
import "./app/PatrolRegionBehavior.js";

import "../style/module.scss";

export const MODULE_ID = "patrol";

Hooks.on("init", () => {
    registerSettings();
});

Hooks.on("ready", () => {
    Patrol.init();
    window.patrolApp = new PatrolApp();
    window.patrolApp.render({ force: true });
});

setupHooks();