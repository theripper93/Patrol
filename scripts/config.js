import { Socket } from "./lib/socket.js";
import { patrolSpotted, patrolAlerted } from "./helpers.js";
import { MODULE_ID } from "./main.js";
import { Patrol } from "./patrol.js";
import { PathPatroller } from "./pathPatroller.js";
import { patrolInstances } from "./main.js";

export function setupHooks() {
    Hooks.on("getSceneControlButtons", (controls, b, c) => {
        if (game.user.isGM) {
            if (!patrolInstances._patrol) patrolInstances._patrol = Patrol.get();
            if (!patrolInstances._pathPatrol) patrolInstances._pathPatrol = PathPatroller.get();
            controls.tokens.tools.patrolToggle = {
                active: patrolInstances._patrol.started,
                icon: "fas fa-walking",
                name: "patrolToggle",
                title: game.i18n.localize("patrol.tools.patrolToggle.hint"),
                onChange: (event, toggle) => {
                    patrolInstances._patrol.started = toggle;
                    patrolInstances._pathPatrol.started = toggle;
                },
                toggle: true,
            };
            controls.tokens.tools.remapPatrolPaths = {
                    button: true,
                    visible: true,
                    icon: "fas fa-draw-polygon",
                    name: "remapPatrolPaths",
                    title: game.i18n.localize("patrol.tools.remapPatrolPaths.hint"),
                    onChange: () => {
                        patrolInstances._pathPatrol.mapTokensAndPaths();
                        patrolInstances._pathPatrol.resetPathIndex();
                    },
                };
        }
    });

    Hooks.on("init", () => {
        Socket.register("spotted", patrolSpotted);
        Socket.register("alerted", patrolAlerted);

        CONFIG.statusEffects.push({
            id: "patrolundetectable",
            name: "Patrol - Undetectable",
            icon: "icons/svg/eye.svg",
        });

        game.settings.register(MODULE_ID, "patrolDiagonals", {
            name: game.i18n.localize("patrol.settings.patrolDiagonals.name"),
            hint: game.i18n.localize("patrol.settings.patrolDiagonals.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
            onChange: (setting) => {
                patrolInstances._patrol.diagonals = setting;
            },
        });

        game.settings.register(MODULE_ID, "patrolSmooth", {
            name: game.i18n.localize("patrol.settings.patrolSmooth.name"),
            hint: game.i18n.localize("patrol.settings.patrolSmooth.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
        });

        game.settings.register(MODULE_ID, "patrolDelay", {
            name: game.i18n.localize("patrol.settings.patrolDelay.name"),
            hint: game.i18n.localize("patrol.settings.patrolDelay.hint"),
            scope: "world",
            config: true,
            type: Number,
            range: {
                min: 500,
                max: 10000,
                step: 100,
            },
            default: 2500,
            onChange: (setting) => {
                patrolInstances._patrol.delay = setting;
            },
        });

        game.settings.register(MODULE_ID, "patrolAlertDelay", {
            name: game.i18n.localize("patrol.settings.patrolAlertDelay.name"),
            hint: game.i18n.localize("patrol.settings.patrolAlertDelay.hint"),
            scope: "world",
            config: true,
            type: Number,
            range: {
                min: 0,
                max: 10000,
                step: 100,
            },
            default: 5000,
        });

        game.settings.register(MODULE_ID, "patrolSound", {
            name: game.i18n.localize("patrol.settings.patrolSound.name"),
            hint: game.i18n.localize("patrol.settings.patrolSound.hint"),
            scope: "world",
            config: true,
            type: String,
            default: "",
            filePicker: true,
        });

        game.settings.register(MODULE_ID, "patrolAlert", {
            name: game.i18n.localize("patrol.settings.patrolAlert.name"),
            hint: game.i18n.localize("patrol.settings.patrolAlert.hint"),
            scope: "world",
            config: true,
            type: String,
            default: "",
            filePicker: true,
        });

        game.settings.register(MODULE_ID, "pathPatrolDelay", {
            name: game.i18n.localize("patrol.settings.pathPatrolDelay.name"),
            hint: game.i18n.localize("patrol.settings.pathPatrolDelay.hint"),
            scope: "world",
            config: true,
            type: Number,
            range: {
                min: 500,
                max: 10000,
                step: 100,
            },
            default: 2500,
            onChange: (setting) => {
                patrolInstances._pathPatrol.delay = setting;
            },
        });

        game.settings.register(MODULE_ID, "resetToRandomNode", {
            name: game.i18n.localize("patrol.settings.resetToRandomNode.name"),
            hint: game.i18n.localize("patrol.settings.resetToRandomNode.hint"),
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
        });
    });

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
            <label>${game.i18n.localize("patrol.tokenConfig.multiPath.name")}</label>
            <input type="checkbox" name="flags.${MODULE_ID}.multiPath" data-dtype="Boolean" ${token.getFlag(MODULE_ID, "multiPath") ? "checked" : ""}>
          </div>
          <div class="form-group">
            <label>${game.i18n.localize("patrol.tokenConfig.patrolPathName.name")}</label>
            <input type="text" name="flags.${MODULE_ID}.patrolPathName" value="${token.getFlag(MODULE_ID, "patrolPathName") ?? ""}">
            <label>${game.i18n.localize("patrol.tokenConfig.pathNodeIndex.name")}</label>
            <input type="text" name="flags.${MODULE_ID}.pathNodeIndex" value="${token.getFlag(MODULE_ID, "pathNodeIndex") ?? 0}">
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
      

    Hooks.on("createDrawing", () => {
        if (game.user.isGM) {
            patrolInstances._patrol.mapTokens();
            patrolInstances._pathPatrol.mapTokensAndPaths();
        }
    });

    Hooks.on("updateDrawing", () => {
        if (game.user.isGM) {
            patrolInstances._patrol.mapTokens();
            patrolInstances._pathPatrol.resetPathIndex();
        }
    });

    Hooks.on("deleteDrawing", () => {
        if (game.user.isGM) {
            patrolInstances._patrol.mapTokens();
            patrolInstances._pathPatrol.resetPathIndex();
        }
    });

    Hooks.on("createToken", () => {
        if (game.user.isGM) {
            patrolInstances._patrol.mapTokens();
            patrolInstances._pathPatrol.mapTokensAndPaths();
        }
    });

    Hooks.on("deleteToken", () => {
        if (game.user.isGM) {
            patrolInstances._patrol.mapTokens();
            patrolInstances._pathPatrol.mapTokensAndPaths();
        }
    });

    Hooks.on("updateToken", async (tokend, updates) => {
        if (game.user.isGM && updates.flags?.patrol && (updates.flags.patrol.pathNodeIndex == undefined || updates.flags.patrol.pathID == undefined)) {
            let token = canvas.tokens.get(tokend.id);
            if (token.document.getFlag(MODULE_ID, "makePatroller")) {
                //console.log(event.data);
                let pathName = token.document.getFlag(MODULE_ID, "patrolPathName");
                let multiPath = token.document.getFlag(MODULE_ID, "multiPath");
                let pathGroup = canvas.drawings.placeables.filter((d) => {
                    if (d.document.text == pathName) {
                        return d;
                    }
                });
                let pathID = "";
                if (pathGroup[0] != undefined) {
                    if (multiPath) {
                        pathID = pathGroup[Math.floor(Math.random() * pathGroup.length)].id;
                    } else {
                        pathID = pathGroup[0].id;
                    }
                }
                await token.document.setFlag(MODULE_ID, "pathID", pathID);
            }
            patrolInstances._pathPatrol.mapTokensAndPaths();
            patrolInstances._patrol.mapTokens();
            patrolInstances._pathPatrol.mapTokensAndPaths();
        }
    });
}
