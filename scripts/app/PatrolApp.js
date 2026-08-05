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
        // exploreRegion(areaId);
    }

    for (const sectionId of Object.keys(cache.sectionsData)) {
        cache.sectionsData[sectionId].blacklist = new Set(cache.sectionsData[sectionId].blacklist);
        cache.sectionsData[sectionId].whitelist = new Set(cache.sectionsData[sectionId].whitelist);
    }

    initTokenAreas();
    initTokenPaths();
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
            graphic: null,
            path: [
                {x: 100, y: 200},
                {x: 100, y: 200},
                {x: 300, y: 200},
                {x: 300, y: 200},
            ]
        },
    },
}

window.stepAllTokens = stepAllTokens;
function stepAllTokens() {
    for (const token of canvas.tokens.placeables) {
        stepToken(token);
    }
}

function stepToken(token) {
    const path = cache.tokenPaths[token.id];
    if (!path) return;
    const step = path.step;
    if (step >= path.path.length) {
        buildNextPath(token);
        stepToken(token);
        return;
    };

    cache.tokenPaths[token.id].step++;
    const next = path.path[step];
    token.document.move([next], { autoRotate: true, constrainOptions: { ignoreWalls: true } });
}

window.patrolCache = cache;

function initTokenAreas() {
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

function initTokenPaths() {
    cache.tokenPaths = {};
    for (const token of canvas.tokens.placeables) {
        // const isPatroller = token.actor?.getFlag(MODULE_ID, "isPatroller");
        // if (!isPatroller) continue;

        const areaId = cache.tokenAreas[token.id];
        if (!areaId) continue;

        buildNextPath(token);
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

    const startOffset = canvas.grid.getOffset({ x: token.bounds.x, y: token.bounds.y });
    const visited = new Set();
    const frontier = [startOffset];
    const wallCache = new Map();
    const cells = [];
    
    const startKey = `${startOffset.i},${startOffset.j}`;
    visited.add(startKey);

    // const cellSet = new Set(areaData.cells.map(c => `${c.i},${c.j}`));

    while (frontier.length > 0) {
        const cell = frontier.shift();
        cells.push({i: cell.i, j: cell.j});

        for (const neighbor of getAdjacentOffsets(cell, { diagonals: false })) {
            const key = `${neighbor.i},${neighbor.j}`;
            if (visited.has(key)) continue;

            // // Must be inside the region polygon
            const center = canvas.grid.getCenterPoint(neighbor);
            if (!region.polygonTree.testPoint(center)) continue;

            // Must not be blocked by a wall
            if (wallBetween(cell, neighbor, wallCache)) continue;

            // Must have enough space for the token to fit
            if (!tokenFits(token, neighbor, region, wallCache)) continue;

            visited.add(key);
            frontier.push(neighbor);
        }
    }

    return {
        destination: cells[Math.floor(Math.random() * cells.length)],
        validCells: cells
    }
}

function tokenFits(token, cell, region, wallCache) {
    const height = token.document.height;
    const width = token.document.width;

    if (height === 1 && width === 1) return true;

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const subcell = { i: cell.i + i, j: cell.j + j };
            if (!region.polygonTree.testPoint(canvas.grid.getCenterPoint(subcell))) return false;
            if (j < width - 1 && wallBetween(subcell, { i: subcell.i, j: subcell.j + 1 }, wallCache)) return false;
            if (i < height - 1 && wallBetween(subcell, { i: subcell.i + 1, j: subcell.j }, wallCache)) return false;
        }
    }

    return true;
}

let graphic = null;
function buildNextPath(token) {
    const areaId = cache.tokenAreas[token.id];
    if (!areaId) return;

    // const cells = cache.areasData[areaId].cells;
    // if (!cells || !cells.length) return;

    const { destination, validCells } = getNextDestination(token);
    if (!destination) return;

    const start = canvas.grid.getOffset({ x: token.bounds.x, y: token.bounds.y });
    const region = canvas.scene.regions.get(cache.areasData[areaId].regionId);
    const path = getPathFromTo(token, region, validCells, start, destination);

    // DEBUG
    const graphic = cache.tokenPaths[token.id]?.graphic ?? new PIXI.Graphics();
    if (!cache.tokenPaths[token.id]?.graphic) {
        canvas.primary.addChild(graphic);
    }
    graphic.clear();

    const width = token.w;
    const height = token.h;

    const newColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    graphic.lineStyle(2, newColor);
    graphic.beginFill(newColor, 0.5);
    for (const point of path) {
        graphic.drawCircle(point.x + width / 2, point.y + height / 2, 10);
    }
    graphic.endFill();

    cache.tokenPaths[token.id] = {
        step: 0,
        graphic: graphic,
        color: newColor,
        path: path,
    };
}

window.buildNextPath = buildNextPath;

function getAdjacentOffsets(cell, options = { diagonals: true }) {
    const allAdjacentOffsets = canvas.grid.getAdjacentOffsets(cell);
    if (!options.diagonals) {
        return allAdjacentOffsets.filter(offset => offset.i === cell.i || offset.j === cell.j);
    }
    return allAdjacentOffsets;
}

function getPathFromTo(token, region, cells, start, end) {
    const cellSet = new Set(cells.map(c => `${c.i},${c.j}`));
    const sk = `${start.i},${start.j}`;
    const ek = `${end.i},${end.j}`;
    if (!cellSet.has(sk) || !cellSet.has(ek)) return [];

    // BFS
    const parent = new Map();
    const visited = new Set();
    const frontier = [start];
    const wallCache = new Map();
    visited.add(sk);

    // CHECK WALLS HERE TOO
    while (frontier.length > 0) {
        const current = frontier.shift();
        const ck = `${current.i},${current.j}`;
        if (ck === ek) break;

        for (const nb of getAdjacentOffsets(current, { diagonals: false })) {
            const nk = `${nb.i},${nb.j}`;

            if (visited.has(nk)) continue;
            if (!cellSet.has(nk)) continue;
            if (wallBetween(current, nb, wallCache)) continue;
            if (!tokenFits(token, nb, region, wallCache)) continue;

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
        path.push(canvas.grid.getTopLeftPoint(cur));
        const ck = `${cur.i},${cur.j}`;
        if (ck === sk) break;
        cur = parent.get(ck);
        iterations++;
        if (iterations > 100000) break;
    }

    path.pop(); // Remove the starting point, as the token is already there
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

function wallBetween(cellA, cellB, cache) {
    const keyA = `${cellA.i},${cellA.j}`;
    const keyB = `${cellB.i},${cellB.j}`;
    const cacheKey = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;

    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const centerA = canvas.grid.getCenterPoint(cellA);
    const centerB = canvas.grid.getCenterPoint(cellB);

    const collisions = CONFIG.Canvas.polygonBackends.move.testCollision(
        centerA, centerB, { type: "move" },
    );

    const blocked = collisions.length > 0;
    cache.set(cacheKey, blocked);
    return blocked;
}

// window.exploreRegion = exploreRegion;

// function exploreRegion(areaId) {
//     const areaData = cache.areasData[areaId];
//     if (!areaData) return;

//     const region = canvas.scene.regions.get(areaData.regionId);
//     if (!region) return;

//     // const region = canvas.scene.regions.get(areaId);

//     // Find a starting cell inside the region polygon (handles holes)
//     const [i0, j0, i1, j1] = canvas.grid.getOffsetRange(region.bounds);
//     let startOffset = null;

//     for (let i = i0; i < i1; i++) {
//         for (let j = j0; j < j1; j++) {
//             const center = canvas.grid.getCenterPoint({i, j});
//             if (region.polygonTree.testPoint(center, 0.75)) {
//                 startOffset = {i, j};
//                 break;
//             }
//         }
//         if (startOffset) break;
//     }

//     if (!startOffset) return; // No cell inside the polygon

//     // BFS flood fill bounded by polygon containment and walls
//     const visited = new Set();
//     const frontier = [startOffset];
//     const wallCache = new Map();
//     const cells = [];

//     const startKey = `${startOffset.i},${startOffset.j}`;
//     visited.add(startKey);

//     while (frontier.length > 0) {
//         const cell = frontier.shift();
//         cells.push({i: cell.i, j: cell.j});

//         for (const neighbor of canvas.grid.getAdjacentOffsets(cell)) {
//             const key = `${neighbor.i},${neighbor.j}`;
//             if (visited.has(key)) continue;

//             // Must be inside the region polygon
//             const center = canvas.grid.getCenterPoint(neighbor);
//             if (!region.polygonTree.testPoint(center)) continue;

//             // Must not be blocked by a wall
//             // if (wallBetween(cell, neighbor, wallCache)) continue;

//             visited.add(key);
//             frontier.push(neighbor);
//         }
//     }

//     // console.log("cells", cells);
//     areaData.cells = cells;
// }