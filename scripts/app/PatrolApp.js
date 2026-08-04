import { MODULE_ID } from "./main.js";
import { HandlebarsApplication } from "../lib/utils.js";

export class PatrolApp extends HandlebarsApplication {
    
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        

        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = this.element;


    }
}

const currentTokenAreas = {};
function initCurrentTokenAreas() {

}

function getNextArea(token) {
    const isPatroller = token.actor?.getFlag(MODULE_ID, "isPatroller");
    if (!isPatroller) return;

    const currentTokenArea = currentTokenAreas[token.id];
    if (!currentTokenArea) return;

    const allowedAreas = getAllowedAreas(currentTokenArea);
    if (!allowedAreas.length) return currentTokenArea;

    const selectedArea = getRandomArea(allowedAreas);
    currentTokenAreas[token.id] = selectedArea;

    return selectedArea;
}

function getAllowedAreas(areaId) {
    const areaData = getSetting("areasData");
    const connectedAreasIds = areaData[areaId]?.connectedAreas;
    if (!connectedAreasIds) return [];

    const sectionsData = getSetting("sectionsData");

    const userId = game.user.id;
    const allowedAreas = [];
    for (const connectedAreaId of connectedAreasIds) {
        const connectedArea = areaData[connectedAreaId];

        // If token is blacklisted, skip this area
        const areaBlacklist = connectedArea.blacklist;
        const isBlacklistedInArea = areaBlacklist.has(userId);
        if (isBlacklistedInArea) continue;

        // If a whitelist exists, check if the token is whitelisted
        const areaWhitelist = connectedArea.whitelist;
        const isWhitelistedInArea = areaWhitelist.size === 0 || areaWhitelist.has(userId);
        if (isWhitelistedInArea) {
            allowedAreas.push(connectedAreaId);
            continue;
        }

        // If a section exists, check if the token is blacklisted or whitelisted in the section
        // If this area is not in a section, allow the token to enter it as it passed the previous checks
        const sectionId = connectedArea.section;
        const sectionData = sectionsData[sectionId];
        if (!sectionData) {
            allowedAreas.push(connectedAreaId);
            continue;
        };

        const sectionBlacklist = sectionData.blacklist;
        const isBlacklistedInSection = sectionBlacklist.has(userId);
        if (isBlacklistedInSection) continue;

        const sectionWhitelist = sectionData.whitelist;
        const isWhitelistedInSection = sectionWhitelist.size === 0 || sectionWhitelist.has(userId);
        if (isWhitelistedInSection) {
            allowedAreas.push(connectedAreaId);
            continue;
        }

        allowedAreas.push(connectedAreaId);
    }

    return allowedAreas;
}

function getRandomArea(allowedAreas) {
    const total = Object.values(allowedAreas).reduce((sum, value) => sum + value.weight, 0);
    let rand = Math.random() * total;
    for (const [areaId, weight] of Object.entries(allowedAreas)) {
        rand -= weight;
        if (rand <= 0) return areaId;
    }
}


const areasData = {
    "areaUuid0": {
        regionUuid: "regionUuid0",
        connectedAreas: ["areaUuid1", "areaUuid2"],
        blacklist: new Set(), // Set of user IDs, supercedes whitelist
        whitelist: new Set(), // Set of user IDs, ignored if empty
        section: "sectionUuid3",
        weight: 1,
    },
    "areaUuid1": {
        // ...
    }
}

const sectionsData = {
    "sectionUuid3": {
        blacklist: new Set(), // Set of user IDs, supercedes whitelist
        whitelist: new Set(), // Set of user IDs, ignored if empty
    },
    // ...
}