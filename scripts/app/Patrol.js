import { getSetting } from "../settings.js";
import { PatrolToken } from "./PatrolToken.js";

export class Patrol {
    static areas = {};
    static sections = {};
    static #tokens = new Map();
    static #stepping = false;
    static tokensStepTask = null;

    static get stepping() {
        return this.#stepping;
    }

    static set stepping(value) {
        this.#stepping = value;
    }

    static init() {
        this.areas = getSetting("areas");
        this.sections = getSetting("sections");

        for (const areaId of Object.keys(this.areas)) {
            this.areas[areaId].blacklist = new Set(this.areas[areaId].blacklist);
            this.areas[areaId].whitelist = new Set(this.areas[areaId].whitelist);
        }

        for (const sectionId of Object.keys(this.sections)) {
            this.sections[sectionId].blacklist = new Set(this.sections[sectionId].blacklist);
            this.sections[sectionId].whitelist = new Set(this.sections[sectionId].whitelist);
        }

        this.initTokens();
    }

    static initTokens() {
        this.#tokens.clear();
        for (const token of canvas.tokens.placeables) {
            const pt = new PatrolToken(token);
            pt.initArea();
            if (pt.area) {
                this.#tokens.set(token.id, pt);
            }
        }
    }

    static getToken(tokenId) {
        return this.#tokens.get(tokenId);
    }

    static clearTokens() {
        this.#tokens.clear();
    }

    static async toggleStepping(toggle) {
        this.#stepping = toggle;
        if (toggle) {
            if (!Patrol.tokensStepTask) {
                Patrol.tokensStepTask = true;
                Patrol.stepAllTokens();
            }
        } else {
            if (Patrol.tokensStepTask) {
                Patrol.tokensStepTask = false;
            }
        }
    }

    static async stepToken(token) {
        const pt = Patrol.getToken(token.id);
        if (!pt) return;
        await pt.step();
        if (Patrol.tokensStepTask) Patrol.stepToken(token);
    }

    static async stepAllTokens() {
        for (const token of canvas.tokens.placeables) {
            Patrol.stepToken(token);
        }
    }

    static getAdjacentOffsets(cell, options = { diagonals: true }) {
        const allAdjacentOffsets = canvas.grid.getAdjacentOffsets(cell);
        if (!options.diagonals) {
            return allAdjacentOffsets.filter(offset => offset.i === cell.i || offset.j === cell.j);
        }
        return allAdjacentOffsets;
    }

    static wallBetween(cellA, cellB, cache) {
        const keyA = `${cellA.i},${cellA.j}`;
        const keyB = `${cellB.i},${cellB.j}`;
        const cacheKey = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;

        if (cache.has(cacheKey)) return cache.get(cacheKey);

        const centerA = canvas.grid.getCenterPoint(cellA);
        const centerB = canvas.grid.getCenterPoint(cellB);

        const collisions = CONFIG.Canvas.polygonBackends.move.testCollision(
            centerA, centerB, { type: "move", edgeTypes: { wall: { mode: 2 } } },
        );

        const result = { };

        for (const vertex of collisions) {
            for (const edge of vertex.edges) {
                const wall = edge.object;
                if (!wall) { result.blocked = true; continue; }
                if (wall.isDoor) {
                    result.door = wall;
                    if (!wall.isOpen && !getSetting("tokensOpenDoors")) result.blocked = true; // closed/locked doors block
                } else {
                    result.blocked = true;
                }
            }
        }

        // Only cache non-door results (door state can change)
        if (!result.door) cache.set(cacheKey, result);
        return result;
    }

}