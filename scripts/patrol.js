class Patrol {
    constructor() {
        this.tokens = [];
        this.characters = [];
        this.executePatrol = false;
        this.started = false;
        this.delay = game.settings.get(MODULE_NAME_PATROL, "patrolDelay") || 2500;
        this.diagonals = game.settings.get(MODULE_NAME_PATROL, "patrolDiagonals") || false;
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
            .filter((t) => t.document.getFlag(MODULE_NAME_PATROL, "enablePatrol") && !t.actor?.effects?.find((e) => e.getFlag("core", "statusId") === CONFIG.specialStatusEffects.DEFEATED))
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
                    canSpot: t.document.getFlag(MODULE_NAME_PATROL, "enableSpotting"),
                    alerted: false,
                    alertTimedOut: false,
                    spottedToken: undefined,
                });
            });
        this.characters = canvas.tokens.placeables.filter((t) => t.actor && (t.actor?.type == "character" || t.actor?.type == "char" || t.actor?.hasPlayerOwner));
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
        if (_patrol.executePatrol && !game.paused && !game.combat?.started && _patrol.started) {
            let perfStart, perfEnd;
            if (_patrol.DEBUG) perfStart = performance.now();
            _patrol.mapTokens();
            _patrol.executePatrol = false;
            _patrol.patrolSetDelay(_patrol.delay);
            let updates = [];
            let occupiedPositions = [];
            _patrol.tokens
                .filter((token) => token.canSpot && _patrol.detectPlayer(token, true) && (!token.alerted || canvas.grid.measureDistance(token.tokenDocument.center, token.spottedToken.center) < 10))
                .forEach((token) => {
                    occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`);
                });
            for (let token of _patrol.tokens) {
                if (token.spottedToken) occupiedPositions.push(`${token.spottedToken.x}-${token.spottedToken.y}`);
                if (token.canSpot && _patrol.detectPlayer(token) && (!token.alerted || canvas.grid.measureDistance(token.tokenDocument.center, token.spottedToken.center) < 10)) {
                    //occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`)
                    continue;
                }
                if (token.tokenDocument.controlled) continue;
                let validPositions = _patrol.getValidPositions(token, occupiedPositions);
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
                    let snapped = canvas.grid.getSnappedPosition(token.tokenDocument.x, token.tokenDocument.y);
                    token.visitedPositions = [`${snapped.x}-${snapped.y}`];
                    occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`);
                }
            }
            const context = game.settings.get(MODULE_NAME_PATROL, "patrolSmooth") ? { animation: { duration: _patrol.delay } } : {};
            canvas.scene.updateEmbeddedDocuments("Token", updates, context);

            if (_patrol.DEBUG) {
                perfEnd = performance.now();
                console.log(`Patrol compute took ${perfEnd - perfStart} ms, FPS:${Math.round(canvas.app.ticker.FPS)}`);
            }
        }
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
                (!token.patrolPolygon || token.patrolPolygon.contains(d.center.x, d.center.y)) &&
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
            let snapped = canvas.grid.getSnappedPosition(pos.x, pos.y);
            pos.x = snapped.x;
            pos.y = snapped.y;
            let snappedCenter = canvas.grid.getCenter(pos.center.x, pos.center.y);
            pos.center.x = snappedCenter[0];
            pos.center.y = snappedCenter[1];
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
        if (!token.tokenDocument.vision.initialized) _patrol.forceInitVisionSource.bind(token.tokenDocument)();
        token.tokenDocument.vision.initialize(token.tokenDocument.vision.data);

        for (let char of this.characters) {
            if (token.tokenDocument.vision.los.contains(char.center.x, char.center.y)) {
                if (preventEvent) return true;
                let spotter = token.tokenDocument;
                let spotted = char;
                if (game.settings.get(MODULE_NAME_PATROL, "patrolAlertDelay") == 0) {
                    token.alerted = true;
                    token.alertTimedOut = true;
                }
                if (!token.alerted && !token.alertTimedOut) {
                    // Allow a system / module to override if something was spotted
                    if (Hooks.call("prePatrolAlerted", spotter, spotted)) {
                        token.alerted = true;
                        token.spottedToken = spotted;
                        this.patrolAlertTimeout(game.settings.get(MODULE_NAME_PATROL, "patrolAlertDelay"), token);
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
