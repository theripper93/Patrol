import { MODULE_ID } from "../main.js";
import { getSetting } from "../settings.js";
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

Hooks.on("ready", buildPatrolCache);

function buildPatrolCache() {
    cache.sectionsData = getSetting("sectionsData");
    cache.areasData = getSetting("areasData");

    for (const areaId of Object.keys(cache.areasData)) {
        exploreRegion(areaId);
    }

    initCurrentTokenAreas();
}

const cache = {
    areasData: {
        "areaUuid0": {
            regionId: "regionUuid0",
            connectedAreas: ["areaUuid1", "areaUuid2"],
            blacklist: new Set(), // Set of user IDs, supercedes whitelist
            whitelist: new Set(), // Set of user IDs, ignored if empty
            section: "sectionUuid3",
            weight: 1,
            cells: [],
        },
        "areaUuid1": {
            // ...
        }
    },
    sectionsData: {
        "sectionUuid3": {
            blacklist: new Set(), // Set of user IDs, supercedes whitelist
            whitelist: new Set(), // Set of user IDs, ignored if empty
        },
        // ...
    },
    currentTokenAreas: {
        "tokenUuid0": "areaUuid0",
        "tokenUuid1": "areaUuid1",
        // ...
    }
}

window.patrolCache = cache;

function initCurrentTokenAreas() {
    cache.currentTokenAreas = {};
    
    const tokens = canvas.tokens.placeables;
    for (const token of tokens) {
        // const isPatroller = token.actor?.getFlag(MODULE_ID, "isPatroller");
        // if (!isPatroller) continue;

        const areaId = getAreaForToken(token);
        if (!areaId) continue;

        cache.currentTokenAreas[token.id] = areaId;
    }
}

function getAreaForToken(token) {
    for (const [areaId, areaData] of Object.entries(cache.areasData)) {
        const region = canvas.scene.regions.get(areaData.regionId);
        if (!region) continue;

        if (region.polygonTree.testPoint(token.center)) return areaId;
        // const areaData = cache.areasData[areaId];
        // if (areaData.cells.includes(token.center)) return areaId;
    }
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
    // const areaData = getSetting("areasData");
    const connectedAreasIds = cache.areasData[areaId]?.connectedAreas;
    if (!connectedAreasIds) return [];

    // const sectionsData = getSetting("sectionsData");

    const userId = game.user.id;
    const allowedAreas = [];
    for (const connectedAreaId of connectedAreasIds) {
        const connectedArea = cache.areasData[connectedAreaId];

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
        const sectionData = cache.sectionsData[sectionId];
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

function wallBetween(cellA, cellB, cache) {
    const keyA = `${cellA.i},${cellA.j}`;
    const keyB = `${cellB.i},${cellB.j}`;
    const cacheKey = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;

    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const centerA = canvas.grid.getCenterPoint(cellA);
    const centerB = canvas.grid.getCenterPoint(cellB);

    const collisions = CONFIG.Canvas.polygonBackends.sight.testCollision(
        centerA, centerB, { type: "sight" },
    );

    const blocked = collisions.length > 0;
    cache.set(cacheKey, blocked);
    return blocked;
}

window.exploreRegion = exploreRegion;

function exploreRegion(areaId) {
    const areaData = cache.areasData[areaId];
    if (!areaData) return;

    const region = canvas.scene.regions.get(areaData.regionId);
    if (!region) return;

    // const region = canvas.scene.regions.get(areaId);

    // Find a starting cell inside the region polygon (handles holes)
    const [i0, j0, i1, j1] = canvas.grid.getOffsetRange(region.bounds);
    let startOffset = null;

    for (let i = i0; i < i1; i++) {
        for (let j = j0; j < j1; j++) {
            const center = canvas.grid.getCenterPoint({i, j});
            if (region.polygonTree.testPoint(center, 0.75)) {
                startOffset = {i, j};
                break;
            }
        }
        if (startOffset) break;
    }

    if (!startOffset) return; // No cell inside the polygon

    // BFS flood fill bounded by polygon containment and walls
    const visited = new Set();
    const frontier = [startOffset];
    const wallCache = new Map();
    const cells = [];

    const startKey = `${startOffset.i},${startOffset.j}`;
    visited.add(startKey);

    while (frontier.length > 0) {
        const cell = frontier.shift();
        cells.push({i: cell.i, j: cell.j});

        for (const neighbor of canvas.grid.getAdjacentOffsets(cell)) {
            const key = `${neighbor.i},${neighbor.j}`;
            if (visited.has(key)) continue;

            // Must be inside the region polygon
            const center = canvas.grid.getCenterPoint(neighbor);
            if (!region.polygonTree.testPoint(center)) continue;

            // Must not be blocked by a wall
            if (wallBetween(cell, neighbor, wallCache)) continue;

            visited.add(key);
            frontier.push(neighbor);
        }
    }

    // console.log("cells", cells);
    areaData.cells = cells;
}