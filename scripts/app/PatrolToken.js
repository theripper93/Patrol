import { canTokenSeeToken } from "../lib/utils.js";
import { getSetting } from "../settings.js";
import { Patrol } from "./Patrol.js";

const MAX_LOITER = 5;
const MAX_SUSPICIOUS = 5;
const MAX_ALERTED = 5;
const MAX_RETREAT = 5;

export class PatrolToken {
    #token;
    #area;
    #step = 0;
    #loiter = 0;
    #retreat = 0;
    #suspicious = 0;
    #alerted = 0;
    #retreating = false;
    #graphic;
    #graphicAdded = false;
    #color;
    #path = [];
    #lastDoor;
    #state = PatrolToken.STATES.PATROLLING;

    static STATES = {
        STOPPED: 0,
        LOITERING: 1,
        PATROLLING: 2,
        SUSPICIOUS: 3,
        ALERTED: 4,
        MOVING_TO_NEW_AREA: 5,
    }
    
    constructor(token) {
        this.#token = token;
        this.#graphic = new PIXI.Graphics();
    }

    get state() {
        return this.#state;
    }

    set state(newState) {
        const previousState = this.state;
        if (!Object.values(PatrolToken.STATES).includes(newState)) {
            throw new Error(`Invalid state: ${newState}`);
        }
        if (previousState === newState) return;
        if (game.user.isGM) console.log(`PatrolToken ${this.token.name} state changed from ${Object.keys(PatrolToken.STATES)[previousState]} to ${Object.keys(PatrolToken.STATES)[newState]}`); // REMOVE
        
        this.#state = newState;
        this.resetStateCounters();
        this.onStateChange(previousState, newState);
    }

    onStateChange(previousState, currentState) { }

    resetStateCounters() {
        this.#suspicious = 0;
        this.#alerted = 0;
    }

    get token() {
        return this.#token;
    }

    get area() {
        return this.#area;
    }

    set area(areaId) {
        this.#area = areaId;
    }

    get currentStepIndex() {
        return this.#step;
    }

    get path() {
        return this.#path;
    }

    // --- area selection ---

    initArea() {
        const areaId = this.getCurrentArea();
        if (!areaId) return;
        this.area = areaId;
        return areaId;
    }

    getCurrentArea() {
        const allowedAreasIds = this.getAllowedAreas(null, this.token.id);
        if (!allowedAreasIds.length) return;

        for (const areaId of allowedAreasIds) {
            const areaData = Patrol.areas[areaId];
            const region = canvas.scene.regions.get(areaData.regionId);
            if (!region) continue;

            if (region.polygonTree.testPoint(this.token.center)) return areaId;
        }
    }

    getNextArea() {
        const isPatroller = this.token.actor?.getFlag(MODULE_ID, "isPatroller");
        if (!isPatroller) return;

        const currentTokenArea = this.area;
        if (!currentTokenArea) return;

        const allowedAreas = this.getAllowedAreas(currentTokenArea, this.token.id);
        if (!allowedAreas.length) return currentTokenArea;

        const selectedArea = this.getRandomArea(allowedAreas);
        this.area = selectedArea;

        return selectedArea;
    }

    getRandomArea(allowedAreas) {
        const total = Object.values(allowedAreas).reduce((sum, value) => sum + value.weight, 0);
        let rand = Math.random() * total;
        for (const [areaId, weight] of Object.entries(allowedAreas)) {
            rand -= weight;
            if (rand <= 0) return areaId;
        }
    }

    getAllowedAreas(areaId, tokenId) {
        const connectedAreasIds = areaId ? Patrol.areas[areaId]?.connectedAreas : Object.keys(Patrol.areas);
        if (!connectedAreasIds) return [];

        const allowedAreas = [];
        for (const connectedAreaId of connectedAreasIds) {
            const connectedArea = Patrol.areas[connectedAreaId];

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
            const sectionData = Patrol.sections[sectionId];
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

    // --- stepping ---

    updateState() {
        if (this.state === PatrolToken.STATES.PATROLLING) {
            const spotted = this.spotEnemy();
            if (spotted) {
                // TODO: Yellow question mark
                this.state = PatrolToken.STATES.SUSPICIOUS;
                return;
            }
        } else if (this.state === PatrolToken.STATES.SUSPICIOUS) {
            this.#suspicious++;
            if (this.#suspicious < MAX_SUSPICIOUS) {
                // TODO: Maybe look around
                return;
            }
            const spotted = this.spotEnemy();
            if (spotted) {
                // TODO: Yellow question mark
                this.state = PatrolToken.STATES.ALERTED;
            } else {
                this.state = PatrolToken.STATES.PATROLLING;
            }
        } else if (this.state === PatrolToken.STATES.ALERTED) {
            const spotted = this.spotEnemy();
            if (spotted) {
                this.#alerted++;
                if (this.#alerted > MAX_ALERTED) {
                    // TODO: Red exlamation mark and SPOTTED
                    ui.notifications.warn(`Patrol | ${this.token.name} has spotted somebody!`);
                    this.state = PatrolToken.STATES.PATROLLING;
                    return;
                }
            } else {
                if (this.#step >= this.#path.length) {
                    this.state = PatrolToken.STATES.SUSPICIOUS;
                    return;
                }
            }
        }

        return true;
    }

    async step() {

        if (!this.updateState()) return;

        if (this.#step >= this.#path.length) {
            this.computePath();
            return this.step();
        }

        let next = this.#path[this.#step];

        const checkOccupied = true;
        if (checkOccupied) {
            const size = canvas.dimensions.size;
            let occupied = canvas.tokens.placeables.find(t => {
                if (t.id === this.token.id) return false;
                for (let i = 0; i < this.token.document.height; i++) {
                    for (let j = 0; j < this.token.document.width; j++) {
                        const subcell = {
                            x: next.x + j * size + size / 2,
                            y: next.y + i * size + size / 2,
                        }
                        if (t.bounds.contains(subcell.x, subcell.y)) return true;
                    }
                }
            });

            if (occupied) {
                const occupiedPT = Patrol.getToken(occupied.id);
                const nextOccupiedCell = occupiedPT?.path[occupiedPT?.currentStepIndex];
                if (nextOccupiedCell && this.token.bounds.contains(nextOccupiedCell.x, nextOccupiedCell.y)) occupied = null;
            }

            const CHANCE_TO_LOITER = 0.8;

            if (occupied) {
                if (Math.random() < CHANCE_TO_LOITER) {
                    if (this.#loiter > MAX_LOITER) {
                        this.computePath();
                        return;
                    }
                    this.#loiter++;
                    return;
                }

                this.#retreating = !this.#retreating;
                if (this.#retreat > MAX_RETREAT) {
                    this.computePath();
                    return;
                }
                this.#retreat++;
                if (this.#retreating && this.#step > 0) this.#step--;
                return this.step();
            }
        }

        if (this.#retreating) {
            if (this.#step === 0) {
                this.computePath();
                return;
            }
            this.#step--;
        } else {
            this.#step++;
        }

        if (this.#lastDoor && this.#lastDoor.isOpen && getSetting("tokensOpenDoors")) {
            const chanceToCloseDoor = Math.random() < 0.5;
            if (chanceToCloseDoor) this.#lastDoor.update({ ds: CONST.WALL_DOOR_STATES.CLOSED });
            this.#lastDoor = null;
        }

        if (next.door) {
            if (getSetting("tokensOpenDoors")) {
                if (!next.door.isOpen) next.door.update({ ds: CONST.WALL_DOOR_STATES.OPEN });
                this.#lastDoor = next.door;
            }
        }

        await this.token.document.move([next], { autoRotate: true, constrainOptions: { ignoreWalls: true } });
        // if (this.token.document.movementAnimationPromise) return this.token.document.movementAnimationPromise;
    }

    // --- pathfinding ---

    spotEnemy() {
        const visionSource = new CONFIG.Canvas.visionSourceClass({object: this.token});
        visionSource.initialize(this.token._getVisionSourceData());
        if (!visionSource?.los) return false;

        for (const enemy of canvas.tokens.placeables) {
            if (enemy.id === this.token.id) continue;
            if (!enemy.actor?.hasPlayerOwner) continue;

            const spotted = canTokenSeeToken(this.token, enemy, visionSource);
            if (!spotted) continue;

            const enemyOffset = canvas.grid.getOffset(enemy.center);
            this.computePath(enemyOffset);
            if (this.path.length === 0) this.computePath();
            return true;
        }

        return false;
    }

    #createVisionSource() {
        const source = new CONFIG.Canvas.visionSourceClass({object: this.token});
        source.initialize(this.token._getVisionSourceData());
        return source;
    }

    computePath(specificDestination = null) {

        const { destination, validCells } = specificDestination ? {
            destination: specificDestination,
            validCells: []
        } : this.#getNextDestination();

        const regionId = Patrol.areas[this.area]?.regionId;
        const region = regionId ? canvas.scene.regions.get(regionId) : null;
        
        const start = canvas.grid.getOffset({ x: this.token.bounds.x, y: this.token.bounds.y });
        const path = this.#getPathFromTo(region, validCells, start, destination, !!specificDestination || !region);

        if (!this.#graphicAdded) {
            canvas.primary.addChild(this.#graphic);
            this.#graphicAdded = true;
        }
        this.#graphic.clear();

        const width = this.token.w;
        const height = this.token.h;

        const newColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        this.#graphic.lineStyle(2, newColor);
        this.#graphic.beginFill(newColor, 0.5);
        for (const point of path) {
            this.#graphic.drawCircle(point.x + width / 2, point.y + height / 2, 10);
        }
        this.#graphic.endFill();

        this.#step = 0;
        this.#loiter = 0;
        this.#retreat = 0;
        this.#retreating = false;
        this.#color = newColor;
        this.#path = path;
    }

    #getNextDestination() {
        this.area ??= this.getNextArea();
        const regionId = Patrol.areas[this.area]?.regionId;
        const region = regionId ? canvas.scene.regions.get(regionId) : null;

        const startOffset = canvas.grid.getOffset({ x: this.token.bounds.x, y: this.token.bounds.y });
        const visited = new Set();
        const frontier = [startOffset];
        const wallCache = new Map();
        const cells = [];

        const startKey = `${startOffset.i},${startOffset.j}`;
        visited.add(startKey);

        while (frontier.length > 0) {
            const cell = frontier.shift();
            cells.push({i: cell.i, j: cell.j});

            for (const neighbor of Patrol.getAdjacentOffsets(cell, { diagonals: false })) {
                const key = `${neighbor.i},${neighbor.j}`;
                if (visited.has(key)) continue;

                // Must be inside the region polygon
                const center = canvas.grid.getCenterPoint(neighbor);
                if (!region.polygonTree.testPoint(center)) continue;

                // Must not be blocked by a wall
                if (Patrol.wallBetween(cell, neighbor, wallCache).blocked) continue;

                // Must have enough space for the token to fit
                if (!this.#tokenFits(neighbor, region, wallCache, !region)) continue;

                visited.add(key);
                frontier.push(neighbor);
            }
        }

        return {
            destination: cells[Math.floor(Math.random() * cells.length)],
            validCells: cells
        }
    }

    #tokenFits(cell, region, wallCache, ignoreBoundaries = false) {
        const height = this.token.document.height;
        const width = this.token.document.width;

        if (height === 1 && width === 1) return true;

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const subcell = { i: cell.i + i, j: cell.j + j };
                if (!ignoreBoundaries && !region.polygonTree.testPoint(canvas.grid.getCenterPoint(subcell))) return false;
                if (j < width - 1 && Patrol.wallBetween(subcell, { i: subcell.i, j: subcell.j + 1 }, wallCache).blocked) return false;
                if (i < height - 1 && Patrol.wallBetween(subcell, { i: subcell.i + 1, j: subcell.j }, wallCache).blocked) return false;
            }
        }

        return true;
    }

    #getPathFromTo(region, cells, start, end, ignoreBoundaries = false) {
        const cellSet = new Set(cells.map(c => `${c.i},${c.j}`));
        const sk = `${start.i},${start.j}`;
        const ek = `${end.i},${end.j}`;
        if (!ignoreBoundaries && (!cellSet.has(sk) || !cellSet.has(ek))) return [];

        // BFS
        const parent = new Map();
        const visited = new Set();
        const frontier = [start];
        const wallCache = new Map();
        visited.add(sk);

        while (frontier.length > 0) {
            const current = frontier.shift();
            const ck = `${current.i},${current.j}`;
            if (ck === ek) break;

            for (const nb of Patrol.getAdjacentOffsets(current, { diagonals: false })) {
                const nk = `${nb.i},${nb.j}`;

                if (visited.has(nk)) continue;
                if (!ignoreBoundaries && !cellSet.has(nk)) continue;
                const wall = Patrol.wallBetween(current, nb, wallCache);
                if (wall.blocked) continue;
                if (!this.#tokenFits(nb, region, wallCache, ignoreBoundaries)) continue;

                visited.add(nk);
                parent.set(nk, {i: current.i, j: current.j, door: wall.door });
                frontier.push(nb);
            }
        }

        if (!parent.has(ek) && sk !== ek) return [];

        const path = [];
        let cur = end;
        let iterations = 0;
        while (true) {
            const cell = canvas.grid.getTopLeftPoint(cur);
            path.push({...cell, door: cur.door });
            const ck = `${cur.i},${cur.j}`;
            if (ck === sk) break;
            cur = parent.get(ck);
            iterations++;
            if (iterations > 100000) break;
        }

        path.pop(); // Remove the starting point, as the token is already there
        return path.reverse();
    }
}