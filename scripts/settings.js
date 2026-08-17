import { MODULE_ID } from "./main.js";

const SETTING_CACHE = {};
const DEFAULT_CACHE = false;

export function registerSettings() {
    const settings = {
        tokensOpenDoors: {
            type: Boolean,
            default: true,
            scope: "world",
            config: false
        },
        patrolAlertDelay: {
            type: Number,
            default: 3000,
            scope: "world",
            config: false
        },
        patrolSound: {
            type: String,
            default: "",
            filePicker: true,
            scope: "world",
        },
        patrolAlert: {
            type: String,
            default: "",
            filePicker: true,
            scope: "world",
        }
    };

    registerSettingsArray(settings);
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