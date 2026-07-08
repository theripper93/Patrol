import { MODULE_ID } from "./main.js";
import { patrolInstances } from "./main.js";

export class PathPatroller {
    constructor() {
        this.tokens = [];
        this.executePatrol = false;
        this.started = false;
        this.delay = game.settings.get(MODULE_ID, "pathPatrolDelay") || 2500;
        this.pathCoords = [];
        this.pathsInUse = [];
        //this.justReset = [];
    }

    static get() {
        return new PathPatroller();
    }
    async patrolSetDelay(ms) {
        setTimeout(() => {
            this.executePatrol = true;
        }, ms);
    }

    startPatrol() {
        //console.log("Starting patrols...")
        this.mapTokensAndPaths();
        this.patrolSetDelay(this.delay);
        canvas.app.ticker.add(this.doPatrol);
    }

    async resetPathIndex() {
        this.mapTokensAndPaths;
        let resetToRandomNode = game.settings.get(MODULE_ID, "resetToRandomNode") || false;
        let patrolPath;
        for (let token of this.tokens) {
            if (this.pathCoords != undefined) {
                let pathName = token.tokenDocument.document.getFlag(MODULE_ID, "patrolPathName");
                let patrolPathGroup = canvas.drawings.placeables.filter((d) => d.document.text?.includes(pathName));
                let patrolPathIndex = Math.floor(Math.random() * patrolPathGroup.length);
                if (patrolPathGroup[patrolPathIndex] != undefined) {
                    let pathID = patrolPathGroup[patrolPathIndex].document.id;
                    patrolPath = this.pathCoords.filter((coordSet) => {
                        if (coordSet.patrolPath.includes(pathID)) {
                            return coordSet;
                        }
                    });
                    if (resetToRandomNode) {
                        await token.tokenDocument.document.setFlag(MODULE_ID, "pathID", pathID);
                        await token.tokenDocument.document.setFlag(MODULE_ID, "pathNodeIndex", Number(Math.floor(Math.random() * patrolPath.length)));
                    } else {
                        await token.tokenDocument.document.setFlag(MODULE_ID, "pathNodeIndex", 0);
                    }
                }
            }
        }
    }

    stopPatrol() {
        canvas.app.ticker.remove(this.doPatrol);
    }

    async doPatrol() {
        if (patrolInstances._pathPatrol.executePatrol && !game.paused && !game.combat?.started && patrolInstances._pathPatrol.started && patrolInstances._pathPatrol.pathCoords[0] != undefined) {
            patrolInstances._pathPatrol.executePatrol = false;
            patrolInstances._pathPatrol.patrolSetDelay(patrolInstances._pathPatrol.delay);
            let updates = [];
            let pathName = "";
            let pathID = "";
            let patrolPath = [];
            let patrolPathGroup = [];
            let isMultiPath = false;
            var currentPathIndex = 0;
            let name = "";
            let id = "";
            let nextPathID = "";
            for (let token of patrolInstances._pathPatrol.tokens) {
                if (token?.tokenDocument?.actor?.effects?.find((e) => e.getFlag("core", "statusId") === CONFIG.specialStatusEffects.DEFEATED)) continue;
                patrolPathGroup = [];
                name = token.tokenDocument.document.name;
                id = token.tokenDocument.id;
                isMultiPath = false;
                currentPathIndex = await Number(token.tokenDocument.document.getFlag(MODULE_ID, "pathNodeIndex"));
                if (token.tokenDocument.controlled) {
                    continue;
                }
                if (patrolInstances._pathPatrol.pathCoords != undefined) {
                    pathName = token.tokenDocument.document.getFlag(MODULE_ID, "patrolPathName");

                    if (token.tokenDocument.document.getFlag(MODULE_ID, "multiPath")) {
                        isMultiPath = true;
                        patrolPathGroup = canvas.drawings.placeables.filter((d) => {
                            if (d.document?.text == pathName) {
                                return d;
                            }
                        });
                    }

                    pathID = token.tokenDocument.document.getFlag(MODULE_ID, "pathID");
                    patrolPath = patrolInstances._pathPatrol.pathCoords.filter((coordSet) => {
                        if (coordSet.patrolPath.includes(pathID)) {
                            return coordSet;
                        }
                    });
                }
                if (patrolPath[0] != undefined && patrolPath[currentPathIndex]) {
                    updates.push({
                        _id: token.tokenDocument.document.id,
                        x: patrolPath[currentPathIndex].x - token.tokenDocument.document.width * 0.5 * canvas.grid.size,
                        y: patrolPath[currentPathIndex].y - token.tokenDocument.document.height * 0.5 * canvas.grid.size,
                    });
                }
                if (currentPathIndex >= patrolPath.length - 1) {
                    //console.log("Moved to last node - resetting...")
                    currentPathIndex = 0;
                    if (isMultiPath) {
                        //console.log("Multiple paths detected");
                        let nextPatrolPathIndex = 0;
                        //console.log("Suggested next path index: " + nextPatrolPathIndex);
                        if (patrolPathGroup.length > 1) {
                            nextPathID = patrolPathGroup[nextPatrolPathIndex].document.id;
                            //console.log("Suggested next path ID: " + nextPathID);
                            let infiniteCatch = 0;
                            let unusedPathFound = false;
                            //console.log(patrolPathGroup);
                            for (nextPatrolPathIndex = 0; nextPatrolPathIndex <= patrolPathGroup.length - 1; nextPatrolPathIndex++) {
                                //console.log("Trying to find unused path: " + nextPatrolPathIndex);
                                patrolPath = patrolPathGroup[nextPatrolPathIndex];
                                if (!patrolInstances._pathPatrol.pathsInUse.includes(patrolPath.id)) {
                                    //console.log("Found unsed path: " + patrolPath.id);
                                    nextPathID = patrolPath.id;
                                    unusedPathFound = true;
                                    break;
                                }
                            }
                            if (!unusedPathFound) {
                                //console.log("Unsed path not found - picking random new path that is not current");
                                nextPatrolPathIndex = Math.floor(Math.random() * patrolPathGroup.length);
                                //console.log("Suggested next path index: " + nextPatrolPathIndex);
                                nextPathID = patrolPathGroup[nextPatrolPathIndex].document.id;
                                //console.log("Suggested next path ID: " + nextPathID);
                                while (pathID == patrolPathGroup[nextPatrolPathIndex].id && infiniteCatch < patrolPathGroup.length * 2) {
                                    //console.log(pathID + " is the current path! Picking new path...");
                                    nextPatrolPathIndex = Math.floor(Math.random() * patrolPathGroup.length);
                                    nextPathID = patrolPathGroup[nextPatrolPathIndex].document.id;
                                    infiniteCatch += 1;
                                }
                            }
                            //console.log("Selected next path index: " + nextPatrolPathIndex);
                            //console.log("Selected next path ID: " + nextPathID);
                        }
                        //console.log("Paths currently in use: ");
                        //console.log(patrolInstances._pathPatrol.pathsInUse);
                        //console.log("Removing path " + pathID + " from used list...");
                        let pathIndexToRemove;
                        pathIndexToRemove = patrolInstances._pathPatrol.pathsInUse.indexOf(pathID);
                        if (pathIndexToRemove > -1) {
                            patrolInstances._pathPatrol.pathsInUse.splice(pathIndexToRemove, 1);
                        }

                        //console.log("Adding path " + nextPathID + " to used list...");
                        if (nextPathID != undefined) {
                            patrolInstances._pathPatrol.pathsInUse.push(nextPathID);
                        }

                        //console.log("Updating pathID flag to " + patrolPathGroup[nextPatrolPathIndex].document.id);
                        await token.tokenDocument.document.setFlag(MODULE_ID, "pathID", nextPathID);
                    }
                } else {
                    currentPathIndex += 1;
                }
                //console.log("Updating pathIndex flag to " + currentPathIndex);
                await token.tokenDocument.document.setFlag(MODULE_ID, "pathNodeIndex", Number(currentPathIndex));
            }
            const context = {};
            context.movement = {};
            updates.forEach(u => context.movement[u._id] = {autoRotate: game.settings.get("core", "tokenAutoRotate"), animation: { duration: patrolInstances._pathPatrol.delay } });
            canvas.scene.updateEmbeddedDocuments("Token", updates, context);
        }
    }

    mapTokensAndPaths() {
        this.pathsInUse = [];
        this.tokens = [];
        canvas.tokens.placeables
            .filter((t) => t.document.getFlag(MODULE_ID, "makePatroller"))
            .forEach((t) => {
                this.tokens.push({ tokenDocument: t });
                let pathID = t.document.getFlag(MODULE_ID, "pathID");

                if (pathID != undefined) {
                    this.pathsInUse.push(pathID);
                }
            });

        this.pathCoords = [];
        canvas.drawings.placeables
            .filter((d) => d.document.text?.includes("Path"))
            .forEach((path) => {
                let pathPoints = this.polygonToGlobal(path);
                for (let currPointIndex = 0; currPointIndex < pathPoints.length - 1; currPointIndex += 2) {
                    this.pathCoords.push({ patrolPath: path.id, x: pathPoints[currPointIndex], y: pathPoints[currPointIndex + 1] });
                }
            });
    }

    polygonToGlobal(drawing) {
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
}
