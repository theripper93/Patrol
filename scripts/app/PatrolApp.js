import { MODULE_ID } from "../main.js";
import { getSetting } from "../settings.js";
import { HandlebarsApplication, mergeObject, canTokenSeeToken } from "../lib/utils.js";
import { Patrol } from "./Patrol.js";

export class PatrolApp extends HandlebarsApplication {

    #allTokens = true;

    static get DEFAULT_OPTIONS() {
        return mergeObject(super.DEFAULT_OPTIONS, {
            window: {
                contentClasses: ["standard-form"],
                savePosition: true,
            },
            actions: {
                selectSingle: this.selectSingle,
                selectAll: this.selectAll,
                stepForward: this.stepForward,
                toggleStepping: this.toggleStepping,
                stepBackward: this.stepBackward,
            },
            position: {
                width: "auto"
            }
        });
    }

    static get PARTS() {
        return {
            content: {
                template: `modules/${MODULE_ID}/templates/${this.APP_ID}.hbs`,
                classes: ["flexrow"],
		    },
        }
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.stepping = Patrol.stepping;
        context.allTokens = this.#allTokens;
        context.autoDisabled = game.combat?.started || !this.#allTokens;
        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = this.element;
        ui.controls.controls.tokens.tools.patrolToggle.pip = true;
        ui.controls.render();
    }

    static async selectSingle() {
        this.#allTokens = false;
        this.render();
    }

    static async selectAll() {
        this.#allTokens = true;
        this.render();
    }

    async step(backward) {
        if (this.#allTokens) {
            Patrol.stepAllTokens(backward);
        } else {
            Patrol.stepToken(_token, backward);
        }
        this.render();
    }

    static async stepForward() {
        this.step(false);
    }

    static async stepBackward() {
        this.step(true);
    }

    static async toggleStepping() {
        Patrol.toggleStepping(!Patrol.stepping);
        this.render();
    }

    toggle() {
        if (this.rendered) {
            this.close();
        } else {
            this.render({ force: true });
            Patrol.updateGraphics(true);
        }
    }

    async _onClose() {
        Patrol.updateGraphics(false);
        await super._onClose();
        ui.controls.controls.tokens.tools.patrolToggle.pip = false;
        ui.controls.render();
    }
}