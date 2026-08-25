import { MODULE_ID } from "../main.js";
import { getSetting } from "../settings.js";
import { PatrolToken } from "./PatrolToken.js";

export class Patrol {
    static #tokens = new Map();
    static #stepping = false;
    static tokensStepTask = null;
    static wallCache = new Map();

    static get stepping() {
        return this.#stepping;
    }

    static set stepping(value) {
        this.#stepping = value;
    }

    static getToken(tokenId) {
        return this.#tokens.get(tokenId);
    }

    static clearTokens() {
        this.#tokens.clear();
    }

    static clearWallCache() {
        this.wallCache.clear();
    }

    static updateGraphics(toggle) {
        for (const token of Patrol.#tokens.values()) token.updateGraphic(toggle);
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
        ui.controls.controls.tokens.tools.patrolToggle.active = toggle;
        ui.controls.render();
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
        
        if (game.combat?.started) {
            Patrol.toggleStepping(false);
            return;
        }
        
        let canStep = true;
        if (game.paused) canStep = false;
        if (!ui.patrolApp?.allowControlled && token.controlled) canStep = false;
        if (canStep) await pt.step(backward);

        // Throttle
        const elapsed = performance.now() - now;
        if (elapsed < getSetting("minStepDelay")) await new Promise(resolve => setTimeout(resolve, getSetting("minStepDelay") - elapsed));

        if (Patrol.tokensStepTask) Patrol.stepToken(token, backward);
    }

    static async stepAllTokens(backward) {
        for (const token of canvas.tokens.placeables) {
            if (Patrol.tokensStepTask) {
                const randomDelay = Math.random() * getSetting("minStepDelay");
                setTimeout(() => Patrol.stepToken(token, backward), randomDelay);
            } else {
                Patrol.stepToken(token, backward);
            }
        }
    }

    static getAdjacentOffsets(cell, options = { diagonals: true }) {
        const allAdjacentOffsets = canvas.grid.getAdjacentOffsets(cell);
        if (!options.diagonals) {
            return allAdjacentOffsets.filter(offset => offset.i === cell.i || offset.j === cell.j);
        }
        return allAdjacentOffsets;
    }

    static wallBetween(cellA, cellB, patrolToken) {
        const keyA = `${cellA.i},${cellA.j}`;
        const keyB = `${cellB.i},${cellB.j}`;
        const cacheKey = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;

        if (Patrol.wallCache.has(cacheKey)) return Patrol.wallCache.get(cacheKey);

        const centerA = canvas.grid.getCenterPoint(cellA);
        const centerB = canvas.grid.getCenterPoint(cellB);

        if (!game.scenes.viewed.dimensions.sceneRect.contains(centerB.x, centerB.y)) return { blocked: true };

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
                    if (!wall.isOpen && !patrolToken.canPassDoor(wall)) result.blocked = true; // closed/locked doors block
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