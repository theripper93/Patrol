import { MODULE_ID, patrolApp } from "./main.js";
import { Patrol } from "./app/Patrol.js";

export function setupHooks() {
    const onWallEdit = async (wall, update) => Patrol.clearWallCache();
    Hooks.on("drawWall", onWallEdit);
    Hooks.on("controlWall", onWallEdit);

    Hooks.on("getSceneControlButtons", (controls, b, c) => {
        if (game.user.isGM) {
            controls.tokens.tools.patrolToggle = {
                toggle: true,
                active: false,
                pip: false,
                icon: "fas fa-walking",
                name: "patrolToggle",
                title: `<div class="toolclip">
                    <p>
                        <span class="reference">Left-Click</span>
                        <strong>: ${game.i18n.localize(`${MODULE_ID}.tools.patrolToggle.app`)}</strong>
                    </p>
                    <p>
                        <span class="reference">CTRL + Left-Click</span>
                        <strong>: ${game.i18n.localize(`${MODULE_ID}.tools.patrolToggle.stepping`)}</strong>
                    </p>
                </div>`,
                onChange: (event, toggle) => {
                    if (event.altKey) {
                        ui.controls.controls.tokens.tools.patrolToggle.active = !toggle;
                        Patrol.toggleStepping(!Patrol.stepping);
                        patrolApp.render();
                        return;
                    }
                    patrolApp.toggle(toggle);
                },
            };
        }
    });

    Hooks.on("ready", () => {
        CONFIG.statusEffects["patrolundetectable"] = {
            id: "patrolundetectable",
            name: game.i18n.localize(`${MODULE_ID}.statusEffects.patrolundetectable.name`),
            icon: "icons/svg/eye.svg",
        };
    });
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
                <p class="hint">${game.i18n.localize("patrol.tokenConfig.enableSpotting.hint")}</p>
            </div>
        </fieldset>
    `;
            
    const lockRotationInput = html.querySelector("input[name='lockRotation']");
    const formGroup = lockRotationInput.closest(".form-group");
    
    const wrapper = document.createElement("div");
    wrapper.innerHTML = toggleHTML;
    formGroup.insertAdjacentElement("afterend", wrapper);
    
    app.setPosition({ height: "auto" });
}

Hooks.on("renderTokenConfig", renderTokenConfig);
Hooks.on("renderPrototypeTokenConfig",renderTokenConfig);
