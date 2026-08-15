import { MODULE_ID } from "../main.js";
import { getSetting } from "../settings.js";
import { HandlebarsApplication, mergeObject, canTokenSeeToken } from "../lib/utils.js";
import { Patrol } from "./Patrol.js";

const TOKENS_OPEN_DOORS = true;

export class PatrolApp extends HandlebarsApplication {

    #stepping = false;
    #allTokens = true;

    static get DEFAULT_OPTIONS() {
        return mergeObject(super.DEFAULT_OPTIONS, {
            window: {
                contentClasses: ["standard-form"],
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
        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        const html = this.element;

        const button = this.element.querySelector('[data-action="toggleStepping"]');
        if (Patrol.stepping) {
            button.classList.remove("fa-play");
            button.classList.add("fa-pause");
        } else {
            button.classList.remove("fa-pause");
            button.classList.add("fa-play");
        }

        this.element.querySelector('[data-action="selectSingle"]').setAttribute("aria-pressed", this.#allTokens ? "false" : "true");
        this.element.querySelector('[data-action="selectAll"]').setAttribute("aria-pressed", this.#allTokens ? "true" : "false");
    }

    static async selectSingle() {
        this.#allTokens = false;
        this.render();
    }

    static async selectAll() {
        this.#allTokens = true;
        this.render();
    }

    static async stepForward() {
        if (this.#allTokens) {
            Patrol.stepAllTokens();
        } else {
            Patrol.stepToken(_token);
        }
    }

    static async stepBackward() {

    }

    static async toggleStepping() {
        Patrol.toggleStepping(!Patrol.stepping);
        this.render();
    }
}