import { MODULE_ID } from "../main.js";
import { getSetting } from "../settings.js";
import { PatrolToken } from "./PatrolToken.js";

export class Patrol {
    static #tokens = new Map();
    static #stepping = false;
    static tokensStepTask = null;
    static wallCache = new Map();
    static minInterval = 200;

    static get stepping() {
        return this.#stepping;
    }

    static set stepping(value) {
        this.#stepping = value;
    }

    static init() {}

    static getToken(tokenId) {
        return this.#tokens.get(tokenId);
    }

    static clearTokens() {
        this.#tokens.clear();
    }

    static clearWallCache() {
        this.wallCache.clear();
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

    static async stepToken(token, backward) {
        const isPatroller = token.document.getFlag(MODULE_ID, "enablePatrol"); 
        let pt = Patrol.getToken(token.id);
        if (!pt && isPatroller) {
            pt = new PatrolToken(token);
            this.#tokens.set(token.id, pt);
        } else if (pt && !isPatroller) {
            this.#tokens.delete(token.id);
            return;
        } else if (!pt && !isPatroller) {
            return;
        }
        const now = performance.now();
        await pt.step(backward);

        // Throttle
        const elapsed = performance.now() - now;
        if (elapsed < Patrol.minInterval) await new Promise(resolve => setTimeout(resolve, Patrol.minInterval - elapsed));

        if (Patrol.tokensStepTask) Patrol.stepToken(token, backward);
    }

    static async stepAllTokens(backward) {
        for (const token of canvas.tokens.placeables) {
            Patrol.stepToken(token, backward);
        }
    }

    static getAdjacentOffsets(cell, options = { diagonals: true }) {
        const allAdjacentOffsets = canvas.grid.getAdjacentOffsets(cell);
        if (!options.diagonals) {
            return allAdjacentOffsets.filter(offset => offset.i === cell.i || offset.j === cell.j);
        }
        return allAdjacentOffsets;
    }

    static wallBetween(cellA, cellB) {
        const keyA = `${cellA.i},${cellA.j}`;
        const keyB = `${cellB.i},${cellB.j}`;
        const cacheKey = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;

        if (Patrol.wallCache.has(cacheKey)) return Patrol.wallCache.get(cacheKey);

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
        if (!result.door) Patrol.wallCache.set(cacheKey, result);
        return result;
    }

}