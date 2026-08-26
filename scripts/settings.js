import { MODULE_ID } from "./main.js";
import { PatrolApp } from "./app/PatrolApp.js";

const SETTING_CACHE = {};
const DEFAULT_CACHE = true;

export function registerSettings() {
    const settings = {
        patrolMaxSuspicious: {
            type: Number,
            default: 5,
            scope: "world",
            config: true,
        },
        patrolMaxAlerted: {
            type: Number,
            default: 5,
            scope: "world",
            config: true,
        },
        patrolAlert: {
            type: String,
            default: "",
            filePicker: true,
            scope: "world",
            config: true,
        },
        patrolSound: {
            type: String,
            default: "",
            filePicker: true,
            scope: "world",
            config: true,
        },
        minStepDelay: {
            type: Number,
            default: 500,
            min: 100,
            scope: "world",
            config: true,
        },
        animationDuration: {
            type: Number,
            default: 500,
            min: 100,
            scope: "world",
            config: true,
        },
        hidePatrolButtonInSidebar: {
            type: Boolean,
            default: false,
            scope: "world",
            config: true,
            requiresReload: true,
        },
        migrateOnStartupDialog: {
            type: Boolean,
            default: true,
            scope: "world",
            config: true,
        },
    };

    registerSettingsArray(settings);

    game.settings.registerMenu(MODULE_ID, "patrol", {
        name: game.i18n.localize(`${MODULE_ID}.settings.openApplication.name`),
        label: game.i18n.localize(`${MODULE_ID}.settings.openApplication.label`),
        hint: game.i18n.localize(`${MODULE_ID}.settings.openApplication.hint`),
        icon: "fad fa-walking",
        type: PatrolApp,
        config: true,
    });
}

export function getSetting(key) {
    return SETTING_CACHE[key] ?? game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
    return await game.settings.set(MODULE_ID, key, value);
}

function registerSettingsArray(settings) {
    for (const [key, value] of Object.entries(settings)) {
        if (value.config && (typeof value.config === "function")) {
            const configFn = value.config;
            Object.defineProperty(value, "config", {
                get: () => configFn(),
                set: (value) => { }
            });
        }
        if (!value.name) value.name = `${MODULE_ID}.settings.${key}.name`
        if (!value.hint) value.hint = `${MODULE_ID}.settings.${key}.hint`
        if (value.useCache === undefined) value.useCache = DEFAULT_CACHE;
        if (value.useCache) {
            const unwrappedOnChange = value.onChange;
            value.onChange = (value) => {
                SETTING_CACHE[key] = value;
                if (unwrappedOnChange) unwrappedOnChange(value);
            }
        }
        game.settings.register(MODULE_ID, key, value);
        if(value.useCache) SETTING_CACHE[key] = getSetting(key);
    }
}