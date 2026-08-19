

function migrateDrawingsToRegions(scene) {
    if (!scene) scene = canvas.scene;

    const baseRegionData = {
        "color": "#fe6c0b",
        "elevation": {
        },
        "behaviors": [
            {
                "name": "Execute Script",
                "type": "executeScript",
                "system": {
                    "events": [
                        "tokenEnter"
                    ]
                },
            }
        ]
    };

    const drawings = scene.drawings.contents;
    const regionsData = [];
    const toDelete = [];
    let migratedCount = 0;
    
    for (const drawing of drawings) {
        if(!drawing.flags?.levels?.drawingMode || drawing.shape.type !== "r") continue;
        if(drawing.flags?.levels?.drawingMode == 1){
            toDelete.push(drawing.id);
            continue;
        }
        const bottom = drawing.elevation;
        const top = drawing.flags.levels?.rangeTop;
        const elevatorFloors = drawing.flags.levels?.elevatorFloors;
        if (!Number.isNumeric(bottom) || !Number.isNumeric(top)) continue;
        const name = drawing.text || "Levels Stair " + parseFloat(bottom) + "-" + parseFloat(top);
        const regionData = foundry.utils.deepClone(baseRegionData);
        regionData.name = name;
        regionData.elevation.bottom = parseFloat(bottom);
        regionData.elevation.top = parseFloat(top) + 1;
        const scriptSource= regionSourceCodeMapping[drawing.flags.levels?.drawingMode.toString()];
        if(!scriptSource) continue;
        regionData.behaviors[0].system.source = scriptSource.replace("elevatorData", `"${elevatorFloors}"`)
        regionData.shapes = [
            {
                "type": "rectangle",
                "x": drawing.x,
                "y": drawing.y,
                "width": drawing.shape.width,
                "height": drawing.shape.height,
                "rotation": 0,
                "hole": false
            }
        ];
        migratedCount++;
        regionsData.push(regionData);
        toDelete.push(drawing.id);
    }
    await scene.createEmbeddedDocuments("Region", regionsData);
    await scene.deleteEmbeddedDocuments("Drawing", toDelete);
    ui.notifications.notify("Patrol - Migrated " + migratedCount + " drawings to regions in scene " + scene.name);
    console.log("Patrol - Migrated " + migratedCount + " drawings to regions in scene " + scene.name);
    return migratedCount;
}
