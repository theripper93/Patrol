import { MODULE_ID } from "../main.js";

const fields = foundry.data.fields;
class PatrolRegionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {}
class PatrolRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    return {
        whitelist: new fields.SetField(new fields.StringField({ required: true }), { label: game.i18n.localize("TYPES.RegionBehavior.patrol.whitelist")}),
        blacklist: new fields.SetField(new fields.StringField({ required: true }), { label: game.i18n.localize("TYPES.RegionBehavior.patrol.blacklist")}),
        linearPath: new fields.BooleanField({ required: true, label: game.i18n.localize("TYPES.RegionBehavior.patrol.linearPath")}),
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