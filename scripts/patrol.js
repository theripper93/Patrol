import { MODULE_ID } from "./main.js";

export class Patrol {
    constructor() {
        this.tokens = [];
        this.characters = [];
        this.executePatrol = false;
        this.started = false;
        this.delay = game.settings.get(MODULE_ID, "patrolDelay") || 2500;
        this.diagonals = game.settings.get(MODULE_ID, "patrolDiagonals") || false;
        this.DEBUG = false;
        this.handleUpdatesTask = null;
        this.controlTokenTask = null;
        this.currentComputationId = null;
        this.patrolDrawings = [];
        this.paused = game.paused;
        this.computeTime = 0;
        this.computeIterations = 0;
        this.frameComputeTime = 0;
        this.frameComputeIterations = 0;
        if (this.DEBUG) this.performanceInterval = setInterval(this.computePerformance.bind(this), 1000);
        this.stepTokenList = [];
        this.stepping = game.settings.get(MODULE_ID, "steppingMode");
    }

    static get() {
        return new Patrol();
    }

    resetPerformance() {
        this.computeTime += this.frameComputeTime;
        this.frameComputeTime = 0;
        this.computeIterations += this.frameComputeIterations;
        this.frameComputeIterations = 0;
    }

    computePerformance() {
        console.log(`Patrol took: ${(this.computeTime / this.computeIterations).toFixed(2)} ms per iteration, ${this.frameComputeTime.toFixed(2)} ms per s, ${this.computeTime.toFixed(2)} total time, ${this.computeIterations} iterations`);
        this.resetPerformance();
    }

    mapTokens() {
        canvas.tokens.placeables
            .filter((t) => t.document.getFlag(MODULE_ID, "enablePatrol") && !t.actor?.effects?.find((e) => e.statuses.has(CONFIG.specialStatusEffects.DEFEATED)))
            .forEach((t) => {
                const tokenDrawing = this.getDrawing(t, false);
                if (!tokenDrawing) return;
                this.computeToken({
                    tokenDocument: t,
                    visitedPositions: [`${t.x}-${t.y}`],
                    patrolPolygon: tokenDrawing,
                    startsFromPolygon: !!tokenDrawing,
                    canSpot: t.document.getFlag(MODULE_ID, "enableSpotting"),
                    alerted: false,
                    alertTimedOut: false,
                    spottedToken: undefined,
                    computationId: this.currentComputationId,
                });
            });
        this.characters = canvas.tokens.placeables.filter((t) => t.actor?.hasPlayerOwner);
    }

    weightedPick(items) {
        const total = items.reduce((sum, [, w]) => sum + w, 0);
        let rand = Math.random() * total;
        for (const [item, weight] of items) {
            rand -= weight;
            if (rand <= 0) return [item, weight];
        }
    }

    getDrawing(token, strict) {
        let highest = null;
        let lowest = null;
        const tokenDrawings = [];
        for (let drawing of this.patrolDrawings) {
            const polygon = new PIXI.Polygon(this.adjustPolygonPoints(drawing));
            if (!this.inPolygon(polygon, token, strict)) continue;
            const match = drawing.document.text.match(/Patrol(\+|\-|=|\d+)?/);
            if (!match || !match[1]) {
                tokenDrawings.push([polygon, 1]);
                continue;
            }
            if (match[1] === "+") {
                highest = polygon;
                continue;
            }
            if (match[1] === "-") {
                lowest = polygon;
                continue;
            }
            tokenDrawings.push([polygon, parseInt(match[1])]);
        }
        const length = tokenDrawings.length;
        if (lowest && highest && length === 0) return lowest;
        if (lowest && highest && length !== 0) return this.weightedPick(tokenDrawings)[0];
        if (highest) return highest;
        if (lowest && length === 0) return lowest;
        if (length === 0) return;
        if (length === 1) return tokenDrawings[0][0];
        return this.weightedPick(tokenDrawings)[0];
    }
    
    inPolygon(polygon, token, strict) {
        const isCenter = polygon.contains(token.center.x, token.center.y);
        if (strict) return isCenter;
        const isTopLeft = polygon.contains(token.x, token.y);
        const isTopRight = polygon.contains(token.x + token.w, token.y);
        const isBottomLeft = polygon.contains(token.x, token.y + token.h);
        const isBottomRight = polygon.contains(token.x + token.w, token.y + token.h);
        return isCenter || isTopLeft || isTopRight || isBottomLeft || isBottomRight;
    }

    async patrolAlertTimeout(ms, token) {
        setTimeout(() => {
            token.alertTimedOut = true;
            token.alerted = false;
        }, ms);
    }

    _start() {
        if (this.paused || !this.started) return;
        this.patrolDrawings = canvas.drawings.placeables.filter((d) => d.document.text.match(/Patrol\d*/));
        this.currentComputationId = foundry.utils.randomID();
        this.mapTokens();
    }

    _stop() {
        this.currentComputationId = null;
    }

    patrolStart() {
        this.started = true;
        this._start();
    }

    patrolStop() {
        this.started = false;
        this._stop();
    }

    patrolPause() {
        this.paused = true;
        this._stop();
    }

    patrolUnpause() {
        this.paused = false;
        this._start();
    }

    async computeTokensStep(debugTarget) {
        const list = [...this.stepTokenList];
        this.stepTokenList = [];
        for (let token of list) {
            token.nextComputation = this.computeToken(token, debugTarget);
        }
    }

    async computeToken(token, debugTarget) {
        const scheduleNextComputation = async (alertTime = null) => {
            if (!this.started) return;
            if (token.computationId !== this.currentComputationId) return;
            if (token.nextComputation) clearTimeout(token.nextComputation);
            if (token.tokenDocument.movementAnimationPromise) await token.tokenDocument.movementAnimationPromise;
            token.nextComputation = setTimeout(async () => {
                let perfStart, perfEnd;
                if (this.DEBUG) perfStart = performance.now();
                if (this.stepping) this.stepTokenList.push(token);
                else this.computeToken(token);
                if (this.DEBUG) {
                    perfEnd = performance.now();
                    this.frameComputeTime += perfEnd - perfStart;
                    this.frameComputeIterations++;
                }
            }, alertTime ?? this.delay);
        }
        if (token.tokenDocument.controlled) return scheduleNextComputation();
        if (game.paused || game.combat?.started || !this.started) return scheduleNextComputation();
        token.patrolPolygon = this.getDrawing(token.tokenDocument, true) ?? this.getDrawing(token.tokenDocument, false);
        let wandering = false;
        if (!token.patrolPolygon && !token.startFromPolygon) {
            token.patrolPolygon = this.getScenePolygon();
            wandering = true;
        }
        if (!token.patrolPolygon) return;
        if (this.DEBUG && token.patrolPolygon) this.debugDrawPolygon(token.patrolPolygon, 0x00ff00);
        if (token.canSpot && this.detectPlayer(token) && (!token.alerted || canvas.grid.measurePath([token.tokenDocument.center, token.spottedToken.center]) < 10)) return await scheduleNextComputation(game.settings.get(MODULE_ID, "patrolAlertDelay"));
        const position = this.getRandomVisiblePoint(token, wandering, debugTarget);
        if (!position) return scheduleNextComputation();
        const update = {
            _id: token.tokenDocument.id,
            x: position.x,
            y: position.y,
        };
        let autoRotate = false; //game.settings.get("core", "tokenAutoRotate");
        const speed = 0.1;
        const distance = canvas.grid.measurePath([token.tokenDocument.center, update]);
        const duration = (distance.distance * 1000) / (canvas.dimensions.distance * speed);
        try { await token.tokenDocument.document.update(update, { animation: { duration: duration }, movement: { [update._id]: { autoRotate } } }); } catch (e) { }
        if (token.tokenDocument.movementAnimationPromise) await token.tokenDocument.movementAnimationPromise;
        await scheduleNextComputation();
    }

    getScenePolygon() {
        const scene = canvas.scene;
        const polygon = new PIXI.Polygon();
        polygon.points = [
            scene.dimensions.sceneX,
            scene.dimensions.sceneY,
            scene.dimensions.sceneX + scene.dimensions.sceneWidth,
            scene.dimensions.sceneY,
            scene.dimensions.sceneX + scene.dimensions.sceneWidth,
            scene.dimensions.sceneY + scene.dimensions.sceneHeight,
            scene.dimensions.sceneX,
            scene.dimensions.sceneY + scene.dimensions.sceneHeight,
        ];
        return polygon;
    }

    getPolygonIntersection(p1, p2) {
        const possiblePoints = [];
        for (let i = 0; i < this.patrolDrawings.length; i++) {
            const intersections = [];
            const drawing = this.patrolDrawings[i];
            const polygon = new PIXI.Polygon(this.adjustPolygonPoints(drawing));
            for (let j = 0; j < polygon.points.length; j += 2) {
                const p3 = { x: polygon.points[j], y: polygon.points[j + 1] };
                const p4 = { x: polygon.points[(j + 2) % polygon.points.length], y: polygon.points[(j + 3) % polygon.points.length] };
                const intersection = this.segmentsIntersect(p1, p2, p3, p4);
                if (intersection) intersections.push(intersection);
            }
            intersections.sort((a, b) => Math.hypot(a.x - p1.x, a.y - p1.y) - Math.hypot(b.x - p1.x, b.y - p1.y));
            if (intersections.lengh === 1) possiblePoints.push(p2);
            if (intersections.length > 1) possiblePoints.push({
                x: (intersections[0].x + intersections[1].x) / 2,
                y: (intersections[0].y + intersections[1].y) / 2,
            });
        }
        if (possiblePoints.length === 0) return p2;
        possiblePoints.sort((a, b) => Math.hypot(a.x - p1.x, a.y - p1.y) - Math.hypot(b.x - p1.x, b.y - p1.y));
        return possiblePoints[0];
    }
    
    segmentsIntersect(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x, d2y = p4.y - p3.y;

        const denom = d1x * d2y - d1y * d2x;
        if (denom === 0) return false;

        const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
        const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return { x: p1.x + t * d1x, y: p1.y + t * d1y };
        }
        return null;
    }

    getRandomVisiblePoint(token, wandering, debugTarget) {
        const w = token.tokenDocument.w;
        const h = token.tokenDocument.h;
        const grid = canvas.grid.size;
        function snap(point, dx, dy) {
            // const snapped = canvas.grid.getSnappedPoint({ x: point.x, y: point.y }, { mode: CONST.GRID_SNAPPING_MODES.VERTEX });
            const snapped = point;
            console.log(snapped.x, snapped.y, dx, dy);

            // snapped.x -= w / 2;
            // snapped.y -= h / 2;

            // if (dx > 0 && dx >= w / 2) snapped.x -= w / 2;
            // if (dy > 0 && dy >= h / 2) snapped.y -= h / 2;
            // if (dx < 0 && dx <= -w / 2) snapped.x += w / 2;
            // if (dy < 0 && dy <= -h / 2) snapped.y += h / 2;
            
            // if (dx > 0 && dx >= w / 2) snapped.x -= w / 2;
            // if (dy > 0 && dy >= h / 2) snapped.y -= h / 2;
            // if (dx < 0 && dx <= -w / 2) snapped.x += w / 2;
            // if (dy < 0 && dy <= -h / 2) snapped.y += h / 2;
            
            if (dx > 0) {
                if (dx >= w) snapped.x -= w;
                else snapped.x -= dx;
            }
            if (dy > 0) {
                if (dy >= h) snapped.y -= h;
                else snapped.y -= dy;
            }
            
            snapped.x = Math.round(snapped.x / grid) * grid;
            snapped.y = Math.round(snapped.y / grid) * grid;
            console.log(snapped.x, snapped.y);
            return { x: snapped.x, y: snapped.y };
        }
        const polygon = token.patrolPolygon;
        const center = { x: token.tokenDocument.center.x, y: token.tokenDocument.center.y };

        const safeCenter = polygon.contains(center.x, center.y)
            ? center
            : this.nearestPointInsidePolygon(center, polygon);

        const safePoint = {
            x: safeCenter.x - w / 2,
            y: safeCenter.y - h / 2,
        };

        const verts = [];
        for (let i = 0; i < polygon.points.length; i += 2) {
            verts.push({ x: polygon.points[i], y: polygon.points[i + 1] });
        }

        const directions = [];
        const iterations = 8;
        const angle = Math.random() * Math.PI * 2;
        const da = Math.PI * 2 / iterations
        for (let i = 0; i < iterations; i++) {
            const dx = Math.cos(angle + da * i);
            const dy = Math.sin(angle + da * i);
            const segment = this.findNearestExitIntersection(verts, safePoint, dx, dy);
            if (segment === null) continue;
            directions.push([[dx, dy], segment]);
        }

        if (directions.length === 0) return null;
        const [deltas, maxT] = this.weightedPick(directions);
        let [dx, dy] = deltas;
        if (maxT < 1) return null;
        
        const t = (0.5 * Math.random() + 0.5) * maxT;

        dx = dx * t;
        dy = dy * t;

        if (debugTarget) {
            dx = debugTarget.x - safePoint.x;
            dy = debugTarget.y - safePoint.y;
        };

        let targetPoint = {
            x: safePoint.x + dx,
            y: safePoint.y + dy,
        };

        const wall = token.tokenDocument.checkCollision(targetPoint, { mode: "closest" });
        if (wall) {
            targetPoint = { x: wall.x, y: wall.y };
            dx = wall.x - safePoint.x;
            dy = wall.y - safePoint.y;
        }

        if (wandering) {
            targetPoint = this.getPolygonIntersection(safePoint, targetPoint);
            dx = targetPoint.x - safePoint.x;
            dy = targetPoint.y - safePoint.y;
        }

        // return targetPoint;

        return snap(targetPoint, dx, dy);
    }

    nearestPointInsidePolygon(point, polygon, stepSize = 5) {
        if (polygon.contains(point.x, point.y)) return { x: point.x, y: point.y };

        const pts = polygon.points;

        let nearestEdgePoint = null;
        let minDist = Infinity;

        for (let i = 0; i < pts.length; i += 2) {
            const ax = pts[i],       ay = pts[i + 1];
            const bx = pts[(i + 2) % pts.length], by = pts[(i + 3) % pts.length];

            const closest = this.closestPointOnSegment(point, { x: ax, y: ay }, { x: bx, y: by });
            const dx = closest.x - point.x;
            const dy = closest.y - point.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearestEdgePoint = closest;

                const ex = bx - ax, ey = by - ay;
                const len = Math.sqrt(ex * ex + ey * ey);
                nearestEdgePoint.nx = -ey / len;
                nearestEdgePoint.ny =  ex / len;
            }
        }

        let cx = nearestEdgePoint.x;
        let cy = nearestEdgePoint.y;

        for (let i = 0; i < 1000; i++) {
            cx += nearestEdgePoint.nx * stepSize;
            cy += nearestEdgePoint.ny * stepSize;

            if (polygon.contains(cx, cy)) return { x: cx, y: cy };

            if (i === 10) {
                cx = nearestEdgePoint.x;
                cy = nearestEdgePoint.y;
                nearestEdgePoint.nx *= -1;
                nearestEdgePoint.ny *= -1;
            }
        }

        return nearestEdgePoint;
    }

    closestPointOnSegment(p, a, b) {
        const abx = b.x - a.x, aby = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby)));
        return { x: a.x + t * abx, y: a.y + t * aby };
    }

    findNearestExitIntersection(polygon, origin, dx, dy) {
        const hits = [];
        const n = polygon.length;

        for (let i = 0; i < n; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % n];
            const t = this.raySegmentIntersect(origin, dx, dy, a, b);
            if (t !== null && t > 1e-9) hits.push(t);
        }

        hits.sort((a, b) => a - b);

        return hits.length > 0 ? hits[0] : null;
    }

    raySegmentIntersect(origin, dx, dy, a, b) {
        const ex = b.x - a.x;
        const ey = b.y - a.y;

        const denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 1e-10) return null;

        const fx = a.x - origin.x;
        const fy = a.y - origin.y;

        const t = (fx * ey - fy * ex) / denom;
        const u = (fx * dy - fy * dx) / denom;

        if (t > 0 && u >= 0 && u <= 1) return t;
        return null;
    }

    debugDrawPolygon(polygon, color = 0xff0000, alpha = 0.1) {
        // Clean up previous debug drawing
        if (canvas.debugPolygon) {
            canvas.stage.removeChild(canvas.debugPolygon);
            canvas.debugPolygon.destroy();
        }

        const gfx = new PIXI.Graphics();
        gfx.eventMode = "none";
        gfx.lineStyle(2, color, 1);
        gfx.beginFill(color, alpha);
        gfx.drawPolygon(polygon.points);
        gfx.endFill();

        canvas.debugPolygon = canvas.stage.addChild(gfx);
        return gfx;
    }

    normalize(v) {
        const len = Math.sqrt(v.x * v.x + v.y * v.y);
        return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
    }

    adjustPolygonPoints(drawing) {
        let globalCoords = [];
        const document = drawing.document;
        const shape = document.shape;
        const points = shape.points;
        const x = document.x;
        const y = document.y;
        const width = shape.width;
        const height = shape.height;
        const rotationCenter = { x: width / 2, y: height / 2 };
        const rotation = Math.toRadians(document.rotation);
        if (points.length != 0) {
            for (let i = 0; i < points.length; i += 2) {
                const pointX = points[i];
                const pointY = points[i + 1];
                const rotatedPoint = this.rotatePoint(pointX, pointY, rotationCenter, rotation);
                globalCoords.push(x + rotatedPoint.x, y + rotatedPoint.y);
            }
        } else {
            globalCoords = [x, y, x + width, y, x + width, y + height, x, y + height];
        }
        return globalCoords;
    }

    rotatePoint(x, y, center, angle) {
        const x1 = x - center.x;
        const y1 = y - center.y;
        const newX = x1 * Math.cos(angle) - y1 * Math.sin(angle) + center.x;
        const newY = x1 * Math.sin(angle) + y1 * Math.cos(angle) + center.y;
        return { x: newX, y: newY };
    }

    detectPlayer(token, preventEvent = false) {
        for (let char of this.characters) {
            const isUndetectable = char?.actor?.effects?.some((e) => e.statuses.some((s) => s === "patrolundetectable"));
            if (isUndetectable) continue;
            const visionPolygon = new CONFIG.Canvas.visionSourceClass({ sourceId: token.tokenDocument.sourceId, object: token.tokenDocument });
            visionPolygon.initialize(token.tokenDocument._getVisionSourceData());
            if (visionPolygon.fov.contains(char.center.x, char.center.y)) {
                if (preventEvent) return true;
                let spotter = token.tokenDocument;
                let spotted = char;
                if (game.settings.get(MODULE_ID, "patrolAlertDelay") == 0) {
                    token.alerted = true;
                    token.alertTimedOut = true;
                }
                if (!token.alerted && !token.alertTimedOut) {
                    // Allow a system / module to override if something was spotted
                    if (Hooks.call("prePatrolAlerted", spotter, spotted)) {
                        token.alerted = true;
                        token.spottedToken = spotted;
                        this.patrolAlertTimeout(game.settings.get(MODULE_ID, "patrolAlertDelay"), token);
                        // Inform any who want to do something with the spotted info
                        Hooks.callAll("patrolAlerted", spotter, spotted);
                    } else {
                        continue;
                    }
                } else if (token.alertTimedOut) {
                    // Allow a system / module to override if something was spotted
                    if (Hooks.call("prePatrolSpotted", spotter, spotted)) {
                        token.alerted = false;
                        token.alertTimedOut = false;
                        token.spottedToken = undefined;
                        // Inform any who want to do something with the spotted info
                        Hooks.callAll("patrolSpotted", spotter, spotted);
                    } else {
                        continue;
                    }
                }

                return true;
            }
        }
        if (preventEvent) return false;
        token.alertTimedOut = false;
        return false;
    }

    forceInitVisionSource() {
        const origin = this.center;
        const d = canvas.dimensions;

        // Initialize vision source
        this.vision.initialize({
            x: origin.x,
            y: origin.y,
            elevation: this.document.elevation,
            radius: Math.clamped(this.sightRange, 0, d.maxR),
            externalRadius: this.externalRadius,
            angle: this.document.sight.angle,
            contrast: this.document.sight.contrast,
            saturation: this.document.sight.saturation,
            brightness: this.document.sight.brightness,
            attenuation: this.document.sight.attenuation,
            rotation: this.document.rotation,
            visionMode: this.document.sight.visionMode,
            color: Color.from(this.document.sight.color),
            blinded: this.document.hasStatusEffect(CONFIG.specialStatusEffects.BLIND),
            preview: this.isPreview,
        });
    }
}
