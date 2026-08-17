import { MODULE_ID } from "../main.js";

const fields = foundry.data.fields;
class PatrolRegionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {}
class PatrolRegionBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    return {
        whitelist: new fields.SetField(new fields.StringField({ required: true }), { label: "Whitelist"}),
        blacklist: new fields.SetField(new fields.StringField({ required: true }), { label: "Blacklist"}),
        linearPath: new fields.BooleanField({ required: true }),
    };
  }
}

Hooks.once("init", () => {
    const behaviorKey = "patrol.patrol";
    Object.assign(CONFIG.RegionBehavior.dataModels, { [behaviorKey]: PatrolRegionBehaviorType });
    Object.assign(CONFIG.RegionBehavior.typeIcons, { [behaviorKey]: "fas fa-walking" });
    foundry.applications.apps.DocumentSheetConfig.registerSheet(RegionBehavior, "patrol", PatrolRegionBehaviorConfig, {
        types: ["patrol"],
        label: "Patrol Region",
    });
});