export class PatrolMigration {
    
    static async migrateData(scene) {
        if (!scene) scene = canvas.scene;

        const baseRegionData = {
            "color": "#fe6c0b",
            "elevation": {},
            "behaviors": [
                {
                    "name": "Patrol Area",
                    "type": "patrol.patrolArea",
                    "system": {
                        "whitelist": new Set(),
                        "blacklist": new Set(),
                        "type": "area",
                    },
                }
            ]
        };

        const paths = {};
        for (const token of scene.tokens.contents) {
            if (token.getFlag("patrol", "makePatroller")) {
                const pathName = token.getFlag("patrol", "patrolPathName");
                if (!pathName) continue;
                paths[pathName] ??= [];
                paths[pathName].push(token.id);
            }
        }

        const drawings = scene.drawings.contents;
        const regionsData = [];
        const toDelete = [];
        let migratedCount = 0;

        for (const drawing of drawings) {
            if ((drawing.text !== "Patrol") && !drawing.text.includes("Path")) continue;

            const elevation = Number.isNumeric(drawing.elevation) ? parseFloat(drawing.elevation) : 0;
            const name = drawing.text || drawing.name || "Patrol Area";
            const regionData = foundry.utils.deepClone(baseRegionData);
            regionData.name = name;
            regionData.elevation.bottom = elevation;
            regionData.elevation.top = elevation;
            
            if (drawing.text in paths) regionData.behaviors[0].system.whitelist = new Set(paths[drawing.text]);
            regionData.behaviors[0].system.type = drawing.text.includes("Path") ? "edge" : "area";
            const shape = this.migrateShape(drawing);
            if (!shape) continue;
            regionData.shapes = [{ ...shape }];

            regionsData.push(regionData);
            toDelete.push(drawing.id);
            migratedCount++;
        }

        await scene.createEmbeddedDocuments("Region", regionsData);
        // await scene.deleteEmbeddedDocuments("Drawing", toDelete);

        ui.notifications.notify("Patrol - Migrated " + migratedCount + " drawings to regions in scene " + scene.name);
        console.log("Patrol - Migrated " + migratedCount + " drawings to regions in scene " + scene.name);
        return migratedCount;
    }

    static migrateShape(drawing) {
        const { x, y, shape, rotation } = drawing;
        const { type, width, height } = shape;
        switch ( type ) {
            case "r":
                return new foundry.data.RectangleShapeData({
                    x: x + (width / 2),
                    y: y + (height / 2),
                    width, height,
                    anchorX: 0.5, anchorY: 0.5,
                    rotation
                }, {parent: drawing});
            case "e":
                return new foundry.data.EllipseShapeData({
                    x: x + (width / 2),
                    y: y + (height / 2),
                    radiusX: width / 2,
                    radiusY: height / 2,
                    rotation
                }, {parent: drawing});
            case "p": {
                const polygon = new foundry.data.PolygonShapeData({
                    points: shape.points.slice(),
                    origin: {x: width / 2, y: height / 2}
                }, {parent: drawing});
                polygon.rotate(rotation);
                polygon.move({x: x + (width / 2), y: y + (height / 2)});
                return polygon;
            }
            case "c": return false;
        }
    }

    static async migrateCompendiums() {
        let migratedScenes = 0;
        const compendiums = Array.from(game.packs).filter((p) => p.documentName === "Scene");
        for (const compendium of compendiums) {
            if (compendium.locked) {
                console.warn(`Patrol - Compendium ${compendium.collection} is locked, skipping migration.`);
                continue;
            }
            const scenes = await compendium.getDocuments();
            for (const scene of scenes) {
                const migrated = await this.migrateData(scene);
                if (migrated) migratedScenes++;
            }
        }
        if (migratedScenes > 0) {
            ui.notifications.notify(`Patrol - Migrated ${migratedScenes} scenes in compendiums from Patrol Drawings to Patrol Regions.`);
            console.log(`Patrol - Migrated ${migratedScenes} scenes in compendiums from Patrol Drawings to Patrol Regions.`);
        } else {
            ui.notifications.notify(`Patrol - No scenes in compendiums to migrate.`);
            console.log(`Patrol - No scenes in compendiums to migrate.`);
        }
        return migratedScenes;
    }

    static async migrateScenes() {
        const scenes = Array.from(game.scenes);
        let migratedScenes = 0;
        ui.notifications.warn("Patrol - Migrating all scenes, do not refresh the page!");
        for (const scene of scenes) {
            const migrated = await this.migrateData(scene);
            if (migrated) migratedScenes++;
        }
        if (migratedScenes > 0) {
            ui.notifications.notify(`Patrol - Migrated ${migratedScenes} scenes from Patrol Drawings to Patrol Regions.`);
            console.log(`Patrol - Migrated ${migratedScenes} scenes from Patrol Drawings to Patrol Regions.`);
        } else {
            ui.notifications.notify(`Patrol - No scenes to migrate.`);
            console.log(`Patrol - No scenes to migrate.`);
        }
        return migratedScenes;
    }

    static async migrateAll() {
        ui.notifications.warn("Patrol - Migrating all scenes, do not refresh the page!");
        await this.migrateScenes();
        await this.migrateCompendiums();
        ui.notifications.notify(`Patrol - Migration Complete.`);
        await game.settings.set("Patrol", "migrateOnStartupDialog", false);
    }

    static showManualMigrationDialog() {
        new foundry.applications.api.DialogV2({
            window: { title: "Patrol - Migration" },
            position: { width: 400 },
            content: `<div style="max-width: 80vw; max-height: 70vh;">
                <p style="text-wrap: ">Use this dialog to migrate your Patrol Drawings to Patrol Regions. This is required if you want to convert your old Patrol areas without having to recreate them manually as Regions.</p>
                <p class="notification warning">This will modify your scene data. Please backup your world before proceeding.</p>
            </div>`,
            buttons: [
                {
                    label: "Migrate All",
                    action: "all",
                    callback: () => this.migrateAll(),
                },
                {
                    label: "Migrate Scene",
                    action: "scene",
                    callback: () => this.migrateData(),
                },
                {
                    label: "Migrate All Scenes",
                    action: "scenes",
                    callback: () => this.migrateScenes(),
                },
                {
                    label: "Migrate Compendiums",
                    action: "compendiums",
                    callback: () => this.migrateCompendiums(),
                },
                {   
                    label: "Don't Show Again",
                    action: "hide",
                    callback: () => game.settings.set("patrol", "migrateOnStartupDialog", false),
                },
            ],
        }).render({ force: true });
    }
}