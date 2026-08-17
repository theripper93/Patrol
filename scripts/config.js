import { MODULE_ID } from "./main.js";
import { Patrol } from "./app/Patrol.js";

export function setupHooks() {
    const onWallEdit = async (wall, update) => Patrol.clearWallCache();
    Hooks.on("drawWall", onWallEdit);
    Hooks.on("controlWall", onWallEdit);
}

const renderTokenConfig = (app, html, data) => {
    if (!game.user.isGM || html.querySelector("input[name='flags.patrol.enablePatrol']")) return;
    
    const token = app.token;
    
    const toggleHTML = `
        <fieldset>
            <legend><i class="fas fa-walking"></i> Patrol</legend>
            <div class="form-group">
                <label>${game.i18n.localize("patrol.tokenConfig.enablePatrol.name")}</label>
                <input type="checkbox" name="flags.${MODULE_ID}.enablePatrol" data-dtype="Boolean" ${token.getFlag(MODULE_ID, "enablePatrol") ? "checked" : ""}>
            </div>
            <div class="form-group">
                <label>${game.i18n.localize("patrol.tokenConfig.enableSpotting.name")}</label>
                <input type="checkbox" name="flags.${MODULE_ID}.enableSpotting" data-dtype="Boolean" ${token.getFlag(MODULE_ID, "enableSpotting") ? "checked" : ""}>
            </div>
            <div class="form-group">
                <label>${game.i18n.localize("patrol.tokenConfig.makePatroller.name")}</label>
                <input type="checkbox" name="flags.${MODULE_ID}.makePatroller" data-dtype="Boolean" ${token.getFlag(MODULE_ID, "makePatroller") ? "checked" : ""}>
            </div>
        </fieldset>
    `;

    // <label>${game.i18n.localize("patrol.tokenConfig.multiPath.name")}</label>
    // <input type="checkbox" name="flags.${MODULE_ID}.multiPath" data-dtype="Boolean" ${token.getFlag(MODULE_ID, "multiPath") ? "checked" : ""}>
            
    const lockRotationInput = html.querySelector("input[name='lockRotation']");
    const formGroup = lockRotationInput.closest(".form-group");
    
    const wrapper = document.createElement("div");
    wrapper.innerHTML = toggleHTML;
    formGroup.insertAdjacentElement("afterend", wrapper);
    
    app.setPosition({ height: "auto" });
}

    Hooks.on("renderTokenConfig", renderTokenConfig);
    Hooks.on("renderPrototypeTokenConfig",renderTokenConfig);
