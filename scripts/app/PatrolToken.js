import { MODULE_ID, patrolApp } from "../main.js";
import { canTokenSeeToken } from "../lib/utils.js";
import { getSetting } from "../settings.js";
import { Patrol } from "./Patrol.js";
import { patrolAlerted } from "../helpers.js";

const MAX_LOITER = 5;
const MAX_RETREAT = 5;
const CHANCE_TO_LOITER = 0.8;
const CHANCE_TO_SWAP = 0.3;

export class PatrolToken {
    #token;
    #region;
    #step = 0;
    #loiter = 0;
    #retreat = 0;
    #suspicious = 0;
    #rotations = [0, 45, 90, 135, 180, 225, 270, 315];
    #alerted = 0;
    #retreating = false;
    #enemyLocation;
    #graphic;
    #color;
    #path = [];
    #lastDoor;
    #state = PatrolToken.STATES.PATROLLING;

    static STATES = {
        PATROLLING: 0,
        SUSPICIOUS: 1,
        ALERTED: 2,
    }
    
    constructor(token) {
        this.#token = token;
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

    get region() {
        return this.#region;
    }

    set region(value) {
        this.#region = value;
    }

    get currentStepIndex() {
        return this.#step;
    }

    get nextStepOrCurrent() {
        if (this.#step + 1 >= this.#path.length) return this.#path[this.#step];
        return this.#path[this.#step + 1];
    }

    get destination() {
        if (this.#path.length === 0) return undefined;
        return this.#path[this.#path.length - 1];
    }

    get enemyLocation() {
        return this.#enemyLocation;
    }

    get path() {
        return this.#path;
    }

    get regionBehavior() {
        return this.region?.behaviors?.contents?.find(b => b.type === "patrol.patrolArea")?.system;
    }

    // --- region selection ---

    isEdgeRegion() {
        if (!this.region) return false;
        return this.regionBehavior?.type === "edge";
    }

    containsToken(set) {
        if (set.has(this.token.document.id)) return true;
        if (set.has(this.token.document.uuid)) return true;
        if (set.has(this.token.document.name)) return true;

        if (!this.token.actor) return false;

        if (set.has(this.token.actor.id)) return true;
        if (set.has(this.token.actor.uuid)) return true;
        if (set.has(this.token.actor.name)) return true;

        return false;
    }

    getAllowedRegions() {
        const scene = this.token.document.parent;
        const regions = scene.regions.contents;

        let atLeastOneWhitelisted = false;
        const maxDistance = Math.hypot(canvas.dimensions.width, canvas.dimensions.height);
        const allowed = [];
        for (const region of regions) {
            const behavior = region.behaviors.contents.find(b => b.type === "patrol.patrolArea");
            if (!behavior) continue;
            if (behavior.disabled) continue;
            if (!canvas.darknessLevel.between(behavior.system.darkness.min, behavior.system.darkness.max)) continue;

            const blacklist = behavior.system.blacklist;
            if (this.containsToken(blacklist)) continue;

            let whitelisted = false;
            const whitelist = behavior.system.whitelist;
            if (whitelist.size > 0) {
                if (!this.containsToken(whitelist)) continue;
                whitelisted = true;
                atLeastOneWhitelisted = true;
            } 

            const weightModifier = behavior.system.weight;
            const weight = maxDistance - Math.hypot(this.token.document.x - region.bounds.x, this.token.document.y - region.bounds.y);

            allowed.push({
                region: region,
                weight: weight * weightModifier,
                whitelisted: whitelisted,
            });
        }

        if (atLeastOneWhitelisted) return allowed.filter(r => r.whitelisted);

        return allowed;
    }
    
    getRandomRegion(allowedRegions) {
        const total = allowedRegions.reduce((sum, value) => sum + value.weight, 0);
        let rand = Math.random() * total;
        for (const { region, weight } of allowedRegions) {
            rand -= weight;
            if (rand <= 0) return region;
        }
    }

    getCurrentRegion() {
        const allowedRegions = this.getAllowedRegions();
        if (!allowedRegions.length) return;

        for (const { region, weight } of allowedRegions) {
            if (region.polygonTree.testPoint(this.token.center)) return region;
        }
    }

    getNextRegion() {
        const allowedRegions = this.getAllowedRegions();
        if (!allowedRegions.length) return;

        const selectedRegion = this.getRandomRegion(allowedRegions);
        return selectedRegion;
    }

    setNextRegion() {
        this.region = this.getNextRegion();
    }

    // --- stepping ---

    updateState() {
        if (this.state === PatrolToken.STATES.PATROLLING) {
            const spotted = this.spotEnemy({ aboutToSuspect: true });
            if (spotted) {
                patrolAlerted({ uuid: this.token.document.uuid, type: spotted === 10 ? "suspicious" : "suspiciousByProxy" });
                this.state = PatrolToken.STATES.SUSPICIOUS;
                return;
            }
        } else if (this.state === PatrolToken.STATES.SUSPICIOUS) {
            this.#suspicious++;
            if (this.#suspicious < getSetting("patrolMaxSuspicious")) {
                if (this.#rotations.length === 0) this.#rotations = [0, 45, 90, 135, 180, 225, 270, 315];
                const rotation = this.#rotations.splice(Math.floor(Math.random() * this.#rotations.length), 1)[0];
                this.token.document.update({ rotation });
                return;
            }
            const spotted = this.spotEnemy({ aboutToAlert: true });
            if ((spotted === 10) || (spotted === PatrolToken.STATES.ALERTED)) {
                patrolAlerted({ uuid: this.token.document.uuid, type: spotted === 10 ? "alerted" : "alertedByProxy" });
                this.state = PatrolToken.STATES.ALERTED;
            } else {
                patrolAlerted({ uuid: this.token.document.uuid, type: "patrol" });
                this.state = PatrolToken.STATES.PATROLLING;
            }
        } else if (this.state === PatrolToken.STATES.ALERTED) {
            const patrolMaxAlerted = getSetting("patrolMaxAlerted");
            const aboutToSpot = this.#alerted === patrolMaxAlerted;
            const spotted = this.spotEnemy({ aboutToSpot });
            if (spotted === 20) {
                this.state = PatrolToken.STATES.PATROLLING;
                patrolAlerted({ uuid: this.token.document.uuid, type: "patrol" });
                return;
            }
            if (spotted === 10) {
                this.#alerted++;
                if (this.#alerted > patrolMaxAlerted) {
                    patrolAlerted({ uuid: this.token.document.uuid, type: "spotted" });
                    this.state = PatrolToken.STATES.PATROLLING;
                    return;
                }
            } else {
                if (this.#step >= this.#path.length - 1) {
                    patrolAlerted({ uuid: this.token.document.uuid, type: "suspicious" });
                    this.state = PatrolToken.STATES.SUSPICIOUS;
                    return;
                }
            }
        }

        return true;
    }

    async step(backward = false) {
        if (!this.updateState()) return;

        const lastStep = this.#path[this.#step];
        if (
            lastStep &&
            !this.token.movementAnimationPromise &&
            (this.token.document.x !== lastStep.x || this.token.document.y !== lastStep.y)
        ) {
            this.computePath();
            return;
        }

        let step = this.#step;
        if (this.#retreating || backward) step--;
        else step++;

        if ((step >= this.#path.length) || (step < 0)) {
            this.computePath();
            if (step > 1) this.step();
            return;
        }

        let next = this.#path[step];

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
                const nextOccupiedCell = occupiedPT?.nextStepOrCurrent;
                if (nextOccupiedCell && Math.random() > CHANCE_TO_SWAP && this.token.bounds.contains(nextOccupiedCell.x, nextOccupiedCell.y)) occupied = null;
            }

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
                this.#retreat++;
                if (this.#retreat >= MAX_RETREAT) this.computePath();
                return;
            }
        }

        this.#step = step;

        let doorBehavior = this.token.document.getFlag(MODULE_ID, "doorBehavior") ?? ["useRegionSettings"];
        let leaveDoorOpenChance = this.token.document.getFlag(MODULE_ID, "leaveDoorOpen") ?? 0;
        if (doorBehavior.includes("useRegionSettings") && this.region) {
            doorBehavior = this.regionBehavior.doorBehavior;
            leaveDoorOpenChance = this.regionBehavior.leaveDoorOpen;
        }

        const canPassDoor = this.canPassDoor(next.door);
        
        if (canPassDoor) {
            // Closes door just traversed
            if (this.#lastDoor && this.#lastDoor.isOpen) {
                const chanceToCloseDoor = Math.random() > (this.leaveDoorOpenChance / 100);
                if (chanceToCloseDoor) this.#lastDoor.update({ ds: this.#lastDoor.wasLocked ? CONST.WALL_DOOR_STATES.LOCKED : CONST.WALL_DOOR_STATES.CLOSED });
                delete this.#lastDoor.wasLocked;
                this.#lastDoor = null;
            }

            // Opens door
            if (!next.door.isOpen) {
                next.door.wasLocked = next.door.ds === CONST.WALL_DOOR_STATES.LOCKED;
                next.door.update({ ds: CONST.WALL_DOOR_STATES.OPEN });
            }
            this.#lastDoor = next.door;
        }

        await this.token.document.move([next], { autoRotate: true, constrainOptions: { ignoreWalls: true }, animation: { duration: getSetting("animationDuration") } });
        if (this.token.movementAnimationPromise) return this.token.movementAnimationPromise;
    }

    canPassDoor(door) {
        if (!door) return false;

        const doorBehavior = this.doorBehavior;
        if ((door.ds === CONST.WALL_DOOR_STATES.LOCKED) && (!doorBehavior.includes("locked"))) return false;
        if ((door.door === CONST.WALL_DOOR_TYPES.SECRET) && (doorBehavior.includes("secret"))) return true;
        if ((door.door === CONST.WALL_DOOR_TYPES.DOOR) && (doorBehavior.includes("unlocked"))) return true;

        return false;
    }

    get doorBehavior() {
        let doorBehavior = this.token.document.getFlag(MODULE_ID, "doorBehavior") ?? ["useRegionSettings"];
        if (doorBehavior.includes("useRegionSettings") && this.region) {
            doorBehavior = Array.from(this.regionBehavior?.doorBehavior ?? []);
        }
        return doorBehavior;
    }

    get leaveDoorOpenChance() {
        let doorBehavior = this.token.document.getFlag(MODULE_ID, "doorBehavior") ?? ["useRegionSettings"];
        let leaveDoorOpenChance = this.token.document.getFlag(MODULE_ID, "leaveDoorOpen") ?? 0;
        if (doorBehavior.includes("useRegionSettings") && this.region) {
            leaveDoorOpenChance = this.regionBehavior?.leaveDoorOpen;
        } 
        return leaveDoorOpenChance;
    }

    // --- pathfinding ---

    spotEnemy(state) {
        if (!this.token.document.flags[MODULE_ID]?.enableSpotting) return 0;

        const visionSource = new CONFIG.Canvas.visionSourceClass({object: this.token});
        visionSource.initialize(this.token._getVisionSourceData());
        if (!visionSource?.los) return 0;

        let maxRadius = 0;
        let unbounded = false;
        for (const mode of Object.values(this.token.document.detectionModes ?? {})) {
            if (!mode?.enabled) continue;
            if (mode.range === Infinity) { unbounded = true; break; }
            if (mode.range > 0) maxRadius = Math.max(maxRadius, this.token.getLightRadius(mode.range));
        }

        for (const enemy of canvas.tokens.placeables) {
            if (enemy.id === this.token.id) continue;
            let enemyLocation;
            let allyState;
            const pt = Patrol.getToken(enemy.id);
            if (pt && (pt.token.id === this.following) && (pt.state === PatrolToken.STATES.PATROLLING)) {
                this.following = null;
                this.computePath();
                return 20;
            }
            if (pt && pt.enemyLocation) {
                this.following = pt.token.id;
                enemyLocation = pt.enemyLocation;
                allyState = pt.state;
            }
            if (!enemyLocation && !enemy.actor?.hasPlayerOwner) continue;

            if (!unbounded) {
                const dx = enemy.center.x - this.token.center.x;
                const dy = enemy.center.y - this.token.center.y;
                if (Math.hypot(dx, dy) - Math.max(enemy.w, enemy.h) > maxRadius) continue;
            }

            const spotted = canTokenSeeToken(this.token, enemy, visionSource);
            if (!spotted) continue;

            if (enemy.document.hasStatusEffect("patrolundetectable")) continue;

            if (state.aboutToSuspect) {
                if (!Hooks.call("prePatrolSuspicious", this.token, enemy)) continue;
                Hooks.call("patrolSuspicious", this.token, enemy);
            } else if (state.aboutToAlert) {
                if (!Hooks.call("prePatrolAlerted", this.token, enemy)) continue;
                Hooks.call("patrolAlerted", this.token, enemy);
            } else if (state.aboutToSpot) {
                if (!Hooks.call("prePatrolSpotted", this.token, enemy)) continue;
                Hooks.call("patrolSpotted", this.token, enemy);
            }

            const enemyOffset = canvas.grid.getOffset(enemyLocation ? enemyLocation : enemy.center);
            this.computePath(enemyOffset);
            if (this.path.length === 0) this.computePath();
            if (!enemyLocation && !this.#enemyLocation) this.#enemyLocation = this.destination;
            return enemyLocation ? allyState : 10;
        }

        return 0;
    }

    updateGraphic(toggle = true) {
        if (!this.#graphic || this.#graphic.destroyed) {
            this.#graphic = new PIXI.Graphics();
            canvas.primary.addChild(this.#graphic);
        }
        this.#graphic.clear();
        if (!toggle) return;

        const width = this.token.w;
        const height = this.token.h;

        const newColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        this.#graphic.lineStyle(2, newColor);
        this.#graphic.beginFill(newColor, 0.5);
        for (const point of this.#path) {
            this.#graphic.drawCircle(point.x + width / 2, point.y + height / 2, 10);
        }
        this.#graphic.endFill();

        return newColor;
    }

    computePath(specificDestination = null) {
        this.setNextRegion();
        this.#enemyLocation = null;

        let path;
        const start = canvas.grid.getOffset({ x: this.token.bounds.x, y: this.token.bounds.y });
        if (this.isEdgeRegion() && !specificDestination) {
            path = this.computeClosePath();
        } else {
            const { destination, validCells } = specificDestination ? {
                destination: specificDestination,
                validCells: []
            } : this.#getNextDestination();
            
            path = this.#getPathFromTo(validCells, start, destination, !!specificDestination || !this.region);
        }

        // In case region is not reachable
        if (path.length < 2) {
            this.region = null;
            const { destination, validCells } = this.#getNextDestination();
            path = this.#getPathFromTo(validCells, start, destination, !!specificDestination || !this.region);
        }
        
        this.#path = path;
        const color = this.updateGraphic(patrolApp.rendered);
        
        this.#color = color;
        this.#step = 0;
        this.#loiter = 0;
        this.#retreat = 0;
        this.#retreating = false;
    }

    computeClosePath() {
        const polygon = this.region.polygons[0];
        const points = polygon.points;
        const tokenOffset = canvas.grid.getOffset({ x: this.token.bounds.x, y: this.token.bounds.y });
        const regionVertices = [];

        // Take polygon points
        for (let i = 0; i < points.length; i += 2) {
            const cell = canvas.grid.getOffset({ x: points[i], y: points[i + 1] });
            regionVertices.push(cell);
        }
        
        // Add all other vertices
        let tokenInRegion = false;
        const regionBoundaryCells = [];
        for (let i = 0; i < regionVertices.length - 1; i++) {
            let path = this.#getPathFromTo([], regionVertices[i], regionVertices[i + 1], true);
            if (path.length === 0) {
                for (let j = i + 1; j < regionVertices.length - 1; j++) {
                    path = this.#getPathFromTo([], regionVertices[i], regionVertices[j], true);
                    if (path.length > 1) break;
                }
            }
            if (path.length < 2) continue;
            path.pop();
            for (const cell of path) {
                if (cell.i === tokenOffset.i && cell.j === tokenOffset.j) tokenInRegion = true;
                regionBoundaryCells.push(cell);
            }
        }
        
        // Add token position if not in polygon
        if (!tokenInRegion) {
            const path = this.#getPathFromTo([], tokenOffset, regionVertices[0], true);
            if (path.length < 2) return [tokenOffset];
            regionBoundaryCells.unshift(...path);
        }

        // Close the polygon
        const path = this.#getPathFromTo([], regionVertices[regionVertices.length - 1], regionVertices[0], true);
        if (path.length > 0) {
            if (path.length > 1) path.pop();
            regionBoundaryCells.push(...path);
        }

        return regionBoundaryCells;
    }

    #getNextDestination() {
        const startOffset = canvas.grid.getOffset({ x: this.token.bounds.x, y: this.token.bounds.y });
        const visited = new Set();
        const frontier = [startOffset];
        const cells = [];
        const cellsInsideRegion = [];

        let insideRegion = this.region?.polygonTree.testPoint(this.token.center);

        let processed = 0;
        const maxCells = 10000;

        const startKey = `${startOffset.i},${startOffset.j}`;
        visited.add(startKey);

        while (frontier.length > 0) {
            const cell = frontier.shift();
            cells.push({i: cell.i, j: cell.j});
            if (insideRegion) cellsInsideRegion.push({i: cell.i, j: cell.j});

            if (!this.region && (processed++ >= maxCells)) break;

            for (const neighbor of Patrol.getAdjacentOffsets(cell, { diagonals: false })) {
                const key = `${neighbor.i},${neighbor.j}`;
                if (visited.has(key)) continue;
                
                // Must not be blocked by a wall
                if (Patrol.wallBetween(cell, neighbor, this).blocked) continue;
                
                // Must have enough space for the token to fit
                if (!this.#tokenFits(neighbor)) continue;
                
                if (this.region) {
                    // Must be inside the region polygon
                    const center = canvas.grid.getCenterPoint(neighbor);
                    if (!this.region.polygonTree.testPoint(center)) {
                        if (insideRegion) continue;
                    } else {
                        if (!insideRegion) {
                            insideRegion = true;
                            frontier.length = 0;
                            frontier.push(neighbor);
                            visited.add(key);
                            break;
                        }
                    }
                }

                visited.add(key);
                frontier.push(neighbor);
            }
        }

        const relevantCells = insideRegion ? cellsInsideRegion : cells;
        if (relevantCells.length > 1) relevantCells.shift();

        return {
            destination: relevantCells[Math.floor(Math.random() * relevantCells.length)],
            validCells: cells
        }
    }

    #tokenFits(cell) {
        const height = this.token.document.height;
        const width = this.token.document.width;

        if (height === 1 && width === 1) return true;

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const subcell = { i: cell.i + i, j: cell.j + j };
                if (j < width - 1 && Patrol.wallBetween(subcell, { i: subcell.i, j: subcell.j + 1 }, this).blocked) return false;
                if (i < height - 1 && Patrol.wallBetween(subcell, { i: subcell.i + 1, j: subcell.j }, this).blocked) return false;
            }
        }

        return true;
    }

    #getPathFromTo(cells, start, end, ignoreBoundaries = false) {
        const cellSet = new Set(cells.map(c => `${c.i},${c.j}`));
        const sk = `${start.i},${start.j}`;
        const ek = `${end.i},${end.j}`;
        if (!ignoreBoundaries && (!cellSet.has(sk) || !cellSet.has(ek))) return [];

        // BFS
        const parent = new Map();
        const visited = new Set();
        const frontier = [start];
        visited.add(sk);

        while (frontier.length > 0) {
            const current = frontier.shift();
            const ck = `${current.i},${current.j}`;
            if (ck === ek) break;

            for (const nb of Patrol.getAdjacentOffsets(current, { diagonals: false })) {
                const nk = `${nb.i},${nb.j}`;

                if (visited.has(nk)) continue;
                if (!ignoreBoundaries && !cellSet.has(nk)) continue;
                const wall = Patrol.wallBetween(current, nb, this);
                if (wall.blocked) continue;
                if (!this.#tokenFits(nb)) continue;

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

        return path.reverse();
    }
}