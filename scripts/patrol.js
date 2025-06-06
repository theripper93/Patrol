import { MODULE_ID } from "./main.js";
import { patrolInstances } from "./main.js";

export class Patrol {
    constructor() {
        this.tokens = [];
        this.characters = [];
        this.executePatrol = false;
        this.started = false;
        this.delay = game.settings.get(MODULE_ID, "patrolDelay") || 2500;
        this.diagonals = game.settings.get(MODULE_ID, "patrolDiagonals") || false;
        this.DEBUG = false;
    }

    static get() {
        return new Patrol();
    }

    mapTokens() {
        if (this.tokens.some((token) => token.alerted || token.alertTimedOut)) return;
        let patrolDrawings = canvas.drawings.placeables.filter((d) => d.document.text == "Patrol");
        this.tokens = [];
        canvas.tokens.placeables
            .filter((t) => t.document.getFlag(MODULE_ID, "enablePatrol") && !t.actor?.effects?.find((e) => e.getFlag("core", "statusId") === CONFIG.specialStatusEffects.DEFEATED))
            .forEach((t) => {
                let tokenDrawing;
                for (let drawing of patrolDrawings) {
                    let p = new PIXI.Polygon(this.adjustPolygonPoints(drawing));
                    if (p.contains(t.center.x, t.center.y)) tokenDrawing = p;
                }
                this.tokens.push({
                    tokenDocument: t,
                    visitedPositions: [`${t.x}-${t.y}`],
                    patrolPolygon: tokenDrawing,
                    canSpot: t.document.getFlag(MODULE_ID, "enableSpotting"),
                    alerted: false,
                    alertTimedOut: false,
                    spottedToken: undefined,
                });
            });
        this.characters = canvas.tokens.placeables.filter((t) => t.actor?.hasPlayerOwner);
    }

    async patrolSetDelay(ms) {
        setTimeout(() => {
            this.executePatrol = true;
        }, ms);
    }

    async patrolAlertTimeout(ms, token) {
        setTimeout(() => {
            token.alertTimedOut = true;
            token.alerted = false;
        }, ms);
    }

    patrolStart() {
        this.mapTokens();
        this.patrolSetDelay(this.delay);
        canvas.app.ticker.add(this.patrolCompute);
    }

    patrolStop() {
        canvas.app.ticker.remove(this.patrolCompute);
    }

    patrolCompute() {
        if (patrolInstances._patrol.executePatrol && !game.paused && !game.combat?.started && patrolInstances._patrol.started) {
            let perfStart, perfEnd;
            if (patrolInstances._patrol.DEBUG) perfStart = performance.now();
            patrolInstances._patrol.mapTokens();
            patrolInstances._patrol.executePatrol = false;
            patrolInstances._patrol.patrolSetDelay(patrolInstances._patrol.delay);
            let updates = [];
            let occupiedPositions = [];
            patrolInstances._patrol.tokens
                .filter((token) => token.canSpot && patrolInstances._patrol.detectPlayer(token, true) && (!token.alerted || canvas.grid.measureDistance(token.tokenDocument.center, token.spottedToken.center) < 10))
                .forEach((token) => {
                    occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`);
                });
            for (let token of patrolInstances._patrol.tokens) {
                if (token.spottedToken) occupiedPositions.push(`${token.spottedToken.x}-${token.spottedToken.y}`);
                if (token.canSpot && patrolInstances._patrol.detectPlayer(token) && (!token.alerted || canvas.grid.measureDistance(token.tokenDocument.center, token.spottedToken.center) < 10)) {
                    //occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`)
                    continue;
                }
                if (token.tokenDocument.controlled) continue;
                let validPositions = patrolInstances._patrol.getValidPositions(token, occupiedPositions);
                let newPosition = validPositions[Math.floor(Math.random() * validPositions.length)];
                if (validPositions.length != 0) {
                    updates.push({
                        _id: token.tokenDocument.id,
                        x: newPosition.x,
                        y: newPosition.y,
                    });
                    token.visitedPositions.push(`${newPosition.x}-${newPosition.y}`);
                    occupiedPositions.push(`${newPosition.x}-${newPosition.y}`);
                } else {
                    let snapped = canvas.grid.getSnappedPoint({ x: token.tokenDocument.x, y: token.tokenDocument.y }, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
                    token.visitedPositions = [`${snapped.x}-${snapped.y}`];
                    occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`);
                }
            }
            const context = game.settings.get(MODULE_ID, "patrolSmooth") ? { animation: { duration: patrolInstances._patrol.delay } } : {};
            context.movement = {};
            updates.forEach(u => context.movement[u._id] = {autoRotate: game.settings.get("core", "tokenAutoRotate")})
            canvas.scene.updateEmbeddedDocuments("Token", updates, context);

            if (patrolInstances._patrol.DEBUG) {
                perfEnd = performance.now();
                console.log(`Patrol compute took ${perfEnd - perfStart} ms, FPS:${Math.round(canvas.app.ticker.FPS)}`);
            }
        }
    }

    inPolygon(token, position) {
        const isCenter = token.patrolPolygon.contains(position.center.x, position.center.y);
        const isTopLeft = token.patrolPolygon.contains(position.x, position.y);
        return isCenter && isTopLeft;
    }

    getValidPositions(token, occupiedPositions) {
        let validPositions = [];
        this.getDirections(token.tokenDocument).forEach((d) => {
            if (
                // has the token visited this position already?
                !token.visitedPositions.includes(`${d.x}-${d.y}`) &&
                // is the position valid?
                !occupiedPositions.includes(`${d.x}-${d.y}`) &&
                // is the position in the patrol polygon?
                (!token.patrolPolygon || (this.inPolygon(token, d))) &&
                // is there a wall in the way?
                !token.tokenDocument.checkCollision(d.center)
            )
                validPositions.push(d);
        });
        if (token.alerted && validPositions.length != 0) {
            const reducer = (previousPoint, currentPoint) => {
                return canvas.grid.measureDistance(currentPoint.center, token.spottedToken.center) < canvas.grid.measureDistance(previousPoint.center, token.spottedToken.center) ? currentPoint : previousPoint;
            };
            return [validPositions.reduce(reducer)];
        }
        return validPositions;
    }

    getDirections(token) {
        let g = canvas.dimensions.size;
        let positions = [
            {
                x: token.x + g,
                y: token.y,
                center: { x: token.center.x + g, y: token.center.y },
            },
            {
                x: token.x - g,
                y: token.y,
                center: { x: token.center.x - g, y: token.center.y },
            },
            {
                x: token.x,
                y: token.y + g,
                center: { x: token.center.x, y: token.center.y + g },
            },
            {
                x: token.x,
                y: token.y - g,
                center: { x: token.center.x, y: token.center.y - g },
            },
        ];
        if (this.diagonals)
            positions.push(
                {
                    x: token.x + g,
                    y: token.y + g,
                    center: { x: token.center.x + g, y: token.center.y + g },
                },
                {
                    x: token.x - g,
                    y: token.y - g,
                    center: { x: token.center.x - g, y: token.center.y - g },
                },
                {
                    x: token.x - g,
                    y: token.y + g,
                    center: { x: token.center.x - g, y: token.center.y + g },
                },
                {
                    x: token.x + g,
                    y: token.y - g,
                    center: { x: token.center.x + g, y: token.center.y - g },
                },
            );
        for (let pos of positions) {
            let snapped = canvas.grid.getSnappedPoint({ x: pos.x, y: pos.y }, { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
            pos.x = snapped.x;
            pos.y = snapped.y;
            let snappedCenter = canvas.grid.getCenterPoint({ x: pos.center.x, y: pos.center.y }, {});
            pos.center.x = snappedCenter.x;
            pos.center.y = snappedCenter.y;
        }
        return positions;
    }

    adjustPolygonPoints(drawing) {
        let globalCoords = [];
        if (drawing.document.shape.points.length != 0) {
            for (let i = 0; i < drawing.document.shape.points.length; i += 2) {
                globalCoords.push(drawing.document.shape.points[i] + drawing.x, drawing.document.shape.points[i + 1] + drawing.y);
            }
        } else {
            globalCoords = [drawing.bounds.left, drawing.bounds.top, drawing.bounds.right, drawing.bounds.top, drawing.bounds.right, drawing.bounds.bottom, drawing.bounds.left, drawing.bounds.bottom];
        }
        return globalCoords;
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
