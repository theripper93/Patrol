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
        cache.areasData[areaId].blacklist = new Set(cache.areasData[areaId].blacklist);
        cache.areasData[areaId].whitelist = new Set(cache.areasData[areaId].whitelist);
        exploreRegion(areaId);
    }

    for (const sectionId of Object.keys(cache.sectionsData)) {
        cache.sectionsData[sectionId].blacklist = new Set(cache.sectionsData[sectionId].blacklist);
        cache.sectionsData[sectionId].whitelist = new Set(cache.sectionsData[sectionId].whitelist);
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
    tokenAreas: {
        "tokenUuid0": "areaUuid0",
        "tokenUuid1": "areaUuid1",
        // ...
    },
    tokenDestinations: {
        "tokenUuid0": {x: 100, y: 200},
    },
    tokenPaths: {
        "tokenUuid0": {
            step: 0,
            path: [
                {x: 100, y: 200},
                {x: 100, y: 200},
                {x: 300, y: 200},
                {x: 300, y: 200},
            ]
        },
    },
}

window.patrolCache = cache;

function initCurrentTokenAreas() {
    cache.tokenAreas = {};
    
    const tokens = canvas.tokens.placeables;
    for (const token of tokens) {
        // const isPatroller = token.actor?.getFlag(MODULE_ID, "isPatroller");
        // if (!isPatroller) continue;

        const areaId = getAreaForToken(token);
        if (!areaId) continue;

        cache.tokenAreas[token.id] = areaId;
    }
}

function getAreaForToken(token) {
    const allowedAreasIds = getAllowedAreas(null, token.id);
    if (!allowedAreasIds.length) return;

    for (const areaId of allowedAreasIds) {
        const areaData = cache.areasData[areaId];
        const region = canvas.scene.regions.get(areaData.regionId);
        if (!region) continue;

        if (region.polygonTree.testPoint(token.center)) return areaId;
    }
}

function getNextDestination(token) {
    const areaId = cache.tokenAreas[token.id];
    if (!areaId) return;

    const areaData = cache.areasData[areaId];
    if (!areaData) return;

    const region = canvas.scene.regions.get(areaData.regionId);
    if (!region) return;

    const startOffset = canvas.grid.getOffset(token.center);
    const visited = new Set();
    const frontier = [startOffset];
    const wallCache = new Map();
    const cells = [];
    
    const startKey = `${startOffset.i},${startOffset.j}`;
    visited.add(startKey);

    const cellSet = new Set(areaData.cells.map(c => `${c.i},${c.j}`));

    while (frontier.length > 0) {
        const cell = frontier.shift();
        cells.push({i: cell.i, j: cell.j});

        for (const neighbor of canvas.grid.getAdjacentOffsets(cell)) {
            const key = `${neighbor.i},${neighbor.j}`;
            if (visited.has(key)) continue;

            // Must be inside the region polygon
            if (!cellSet.has(key)) continue;

            // Must not be blocked by a wall
            
            if (wallBetween(cell, neighbor, wallCache, {w: token.w, h: token.h})) continue;

            visited.add(key);
            frontier.push(neighbor);
        }
    }

    return {
        destination: cells[Math.floor(Math.random() * cells.length)],
        validCells: cells
    }
}

let graphic = null;
function buildNextPath(token) {
    const areaId = cache.tokenAreas[token.id];
    if (!areaId) return;

    const cells = cache.areasData[areaId].cells;
    if (!cells || !cells.length) return;

    const {destination, validCells} = getNextDestination(token);
    if (!destination) return;

    const start = canvas.grid.getOffset(token.center);
    const path = getPathFromTo(validCells, start, destination);

    // DEBUG
    if (!graphic) graphic = new PIXI.Graphics();
    graphic.clear();
    graphic.lineStyle(2, 0x00ff00);
    graphic.beginFill(0x00ff00, 0.5);
    for (const point of path) {
        graphic.drawCircle(point.x, point.y, 10);
    }
    graphic.endFill();
    canvas.primary.addChild(graphic);
    // DEBUG

    cache.tokenPaths[token.id] = {
        step: 0,
        path: path,
    };
}

window.buildNextPath = buildNextPath;

function getPathFromTo(cells, start, end) {
    const cellSet = new Set(cells.map(c => `${c.i},${c.j}`));
    const sk = `${start.i},${start.j}`;
    const ek = `${end.i},${end.j}`;
    if (!cellSet.has(sk) || !cellSet.has(ek)) return [];

    // BFS
    const parent = new Map();
    const visited = new Set();
    const frontier = [start];
    visited.add(sk);

    while (frontier.length > 0) {
        const current = frontier.shift();
        const ck = `${current.i},${current.j}`;
        if (ck === ek) break;

        for (const nb of canvas.grid.getAdjacentOffsets(current)) {
            const nk = `${nb.i},${nb.j}`;
            if (visited.has(nk) || !cellSet.has(nk)) continue;
            visited.add(nk);
            parent.set(nk, {i: current.i, j: current.j});
            frontier.push(nb);
        }
    }

    if (!parent.has(ek) && sk !== ek) return [];

    const path = [];
    let cur = end;
    let iterations = 0;
    while (true) {
        path.push(canvas.grid.getCenterPoint(cur));
        const ck = `${cur.i},${cur.j}`;
        if (ck === sk) break;
        cur = parent.get(ck);
        iterations++;
        if (iterations > 100000) break;
    }

    return path.reverse();
}

function getNextArea(token) {
    const isPatroller = token.actor?.getFlag(MODULE_ID, "isPatroller");
    if (!isPatroller) return;

    const currentTokenArea = cache.tokenAreas[token.id];
    if (!currentTokenArea) return;

    const allowedAreas = getAllowedAreas(currentTokenArea, token.id);
    if (!allowedAreas.length) return currentTokenArea;

    const selectedArea = getRandomArea(allowedAreas);
    cache.tokenAreas[token.id] = selectedArea;

    return selectedArea;
}

function getAllowedAreas(areaId, tokenId) {
    // const areaData = getSetting("areasData");
    const connectedAreasIds = areaId ? cache.areasData[areaId]?.connectedAreas : Object.keys(cache.areasData);
    if (!connectedAreasIds) return [];

    // const sectionsData = getSetting("sectionsData");

    const allowedAreas = [];
    for (const connectedAreaId of connectedAreasIds) {
        const connectedArea = cache.areasData[connectedAreaId];

        // If token is blacklisted, skip this area
        const areaBlacklist = connectedArea.blacklist;
        const isBlacklistedInArea = areaBlacklist.has(tokenId);
        if (isBlacklistedInArea) continue;

        // If a whitelist exists, check if the token is whitelisted
        const areaWhitelist = connectedArea.whitelist;
        const isWhitelistedInArea = areaWhitelist.size === 0 || areaWhitelist.has(tokenId);
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
        const isBlacklistedInSection = sectionBlacklist.has(tokenId);
        if (isBlacklistedInSection) continue;

        const sectionWhitelist = sectionData.whitelist;
        const isWhitelistedInSection = sectionWhitelist.size === 0 || sectionWhitelist.has(tokenId);
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

function wallBetween(cellA, cellB, cache, tokenDimensions = null) {
    const keyA = `${cellA.i},${cellA.j}`;
    const keyB = `${cellB.i},${cellB.j}`;
    const cacheKey = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;

    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const centerA = canvas.grid.getCenterPoint(cellA);
    const centerB = canvas.grid.getCenterPoint(cellB);

    const collisions = CONFIG.Canvas.polygonBackends.move.testCollision(
        centerA, centerB, { type: "move" },
    );

    let cornersBlocked = false;
    if (tokenDimensions) {
        const offsets = [
            { x: - tokenDimensions.w / 2, y: - tokenDimensions.h / 2 },
            { x: tokenDimensions.w / 2, y: - tokenDimensions.h / 2 },
            { x: - tokenDimensions.w / 2, y: tokenDimensions.h / 2 },
            { x: tokenDimensions.w / 2, y: tokenDimensions.h / 2 },
        ];
    
        for (const offset of offsets) {
            const pointA = {
                x: centerA.x + offset.x,
                y: centerA.y + offset.y,
            };
            const pointB = {
                x: centerB.x + offset.x,
                y: centerB.y + offset.y,
            };
            const collisions = CONFIG.Canvas.polygonBackends.move.testCollision(
                pointA, pointB, { type: "move" },
            );
            if (collisions.length > 0) {
                cornersBlocked = true;
                break;
            }
        }
    }

    const blocked = collisions.length > 0 || cornersBlocked;
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
            // if (wallBetween(cell, neighbor, wallCache)) continue;

            visited.add(key);
            frontier.push(neighbor);
        }
    }

    // console.log("cells", cells);
    areaData.cells = cells;
}