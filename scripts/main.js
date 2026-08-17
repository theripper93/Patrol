import { setupHooks } from "./config.js";
import { Patrol } from "./app/Patrol.js";
import { PatrolApp } from "./app/PatrolApp.js";
import { registerSettings } from "./settings.js";
import "./app/PatrolRegionBehavior.js";

import "../style/module.scss";

export const MODULE_ID = "patrol";
export let patrolApp;

Hooks.on("init", () => {
    registerSettings();
});

Hooks.on("setup", () => {
    setupHooks();
});

Hooks.on("ready", () => {
    if (!game.user.isGM) return;
    const API = {};
    game.modules.get(MODULE_ID).API = API;
    patrolApp = new PatrolApp();
    ui.patrolApp = patrolApp;
});