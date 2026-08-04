import { MODULE_ID } from "./main.js";

const SETTING_CACHE = {};
const DEFAULT_CACHE = false;

export function registerSettings() {
    const settings = {
        areasData: {
            type: Object,
            default: {
                "areaUuid0": {
                    regionId: "T6o7DbtIxeoYmHQW",
                    connectedAreas: [],
                    blacklist: new Set(), // Set of user IDs, supercedes whitelist
                    whitelist: new Set(), // Set of user IDs, ignored if empty
                    section: null,
                    weight: 1,
                    cells: [],
                },
            },
            scope: "world",
            config: false
        },
        sectionsData: {
            type: Object,
            default: {},
            scope: "world",
            config: false
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