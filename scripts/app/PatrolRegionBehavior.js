import { MODULE_ID } from "../main.js";

const fields = foundry.data.fields;
class PatrolRegionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {}
class PatrolRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
    static defineSchema() {
        return {
            type: new fields.StringField({
                required: true,
                initial: "area",
                label: game.i18n.localize("TYPES.RegionBehavior.patrol.type.label"),
                hint: game.i18n.localize("TYPES.RegionBehavior.patrol.type.hint"),
                choices: { 
                    "area": game.i18n.localize("TYPES.RegionBehavior.patrol.type.choices.area"),
                    "edge": game.i18n.localize("TYPES.RegionBehavior.patrol.type.choices.edge")
                },
            }),
            whitelist: new fields.SetField(
                new fields.StringField({ required: true }),
                { label: game.i18n.localize("TYPES.RegionBehavior.patrol.whitelist") }
            ),
            blacklist: new fields.SetField(
                new fields.StringField({ required: true }),
                { label: game.i18n.localize("TYPES.RegionBehavior.patrol.blacklist") }
            ),
            weight: new fields.NumberField({
                min: 1,
                max: 100,
                step: 1,
                initial: 50,
                label: game.i18n.localize("TYPES.RegionBehavior.patrol.weight.label"),
                hint: game.i18n.localize("TYPES.RegionBehavior.patrol.weight.hint"),
            }),
            doorBehavior: new fields.SetField(
                new fields.StringField({
                    initial: "unlocked",
                    choices: { 
                        "unlocked": game.i18n.localize("patrol.tokenConfig.doorBehavior.choices.unlocked"),
                        "locked": game.i18n.localize("patrol.tokenConfig.doorBehavior.choices.locked"),
                        "secret": game.i18n.localize("patrol.tokenConfig.doorBehavior.choices.secret")
                    },
                }),
                { label: game.i18n.localize("patrol.tokenConfig.doorBehavior.name") }
            ),
            leaveDoorOpen: new fields.NumberField({
                min: 0,
                max: 100,
                step: 1,
                initial: 0,
                label: game.i18n.localize("patrol.tokenConfig.leaveDoorOpen.name"),
                hint: game.i18n.localize("patrol.tokenConfig.leaveDoorOpen.hint"),
            }),
            darkness: new fields.SchemaField({
                min: new fields.NumberField({
                    min: 0,
                    max: 1,
                    step: 0.01,
                    initial: 0,
                    label: game.i18n.localize("TYPES.RegionBehavior.patrol.darkness.min.label"),
                    hint: game.i18n.localize("TYPES.RegionBehavior.patrol.darkness.min.hint"),
                }),
                max: new fields.NumberField({
                    min: 0,
                    max: 1,
                    step: 0.01,
                    initial: 1,
                    label: game.i18n.localize("TYPES.RegionBehavior.patrol.darkness.max.label"),
                    hint: game.i18n.localize("TYPES.RegionBehavior.patrol.darkness.max.hint"),
                }),
            }, {
                validate: (value) => value.min <= value.max,
                validationError: game.i18n.localize("TYPES.RegionBehavior.patrol.darkness.validationError"),
            }),
        };
    }
}

Hooks.once("init", () => {
      const behaviorKey = "patrol.patrolArea";
      Object.assign(CONFIG.RegionBehavior.dataModels, { [behaviorKey]: PatrolRegionBehaviorType });
      Object.assign(CONFIG.RegionBehavior.typeIcons, { [behaviorKey]: "fas fa-walking" });
      foundry.applications.apps.DocumentSheetConfig.registerSheet(RegionBehavior, "patrol", PatrolRegionBehaviorConfig, {
          types: ["patrolArea"],
          label: game.i18n.localize("TYPES.RegionBehavior.patrol.patrolArea"),
      });
});