let _patrolSocket;

Hooks.once("socketlib.ready", () => {
	_patrolSocket = socketlib.registerModule(MODULE_NAME_PATROL);
	_patrolSocket.register("spotted", patrolSpotted);
  _patrolSocket.register("alerted", patrolAlerted);
});

Hooks.on("getSceneControlButtons", (controls, b, c) => {
  if (game.user.isGM) {
    if (!_patrol) _patrol = Patrol.get();
    basictools = controls.find((x) => x["name"] == "token").tools;
    basictools.push({
      active: _patrol.started,
      icon: "fas fa-walking",
      name: "patrolToggle",
      title: game.i18n.localize("patrol.tools.patrolToggle.hint"),
      onClick: (toggle) => {
        _patrol.started = toggle;
      },
      toggle: true,
    });
  }
});

Hooks.on("init", () => {

  game.settings.register(MODULE_NAME_PATROL, "patrolDiagonals", {
    name: game.i18n.localize("patrol.settings.patrolDiagonals.name"),
    hint: game.i18n.localize("patrol.settings.patrolDiagonals.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: (setting) => {
      _patrol.diagonals = setting;
    },
  });

  game.settings.register(MODULE_NAME_PATROL, "patrolDelay", {
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
      _patrol.delay = setting;
    },
  });

  game.settings.register(MODULE_NAME_PATROL, "patrolAlertDelay", {
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

  game.settings.register(MODULE_NAME_PATROL, "patrolSound", {
    name: game.i18n.localize("patrol.settings.patrolSound.name"),
    hint: game.i18n.localize("patrol.settings.patrolSound.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: true
  });

  game.settings.register(MODULE_NAME_PATROL, "patrolAlert", {
    name: game.i18n.localize("patrol.settings.patrolAlert.name"),
    hint: game.i18n.localize("patrol.settings.patrolAlert.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "",
    filePicker: true
  });

  libWrapper.register(MODULE_NAME_PATROL,"Token.prototype.animateMovement", _patrolAnimateMovement, "OVERRIDE")

});

Hooks.on("renderTokenConfig", (app, html, data) => {
  if (!game.user.isGM) return;
  let toggleHTML = `<div class="form-group">
  <label>${game.i18n.localize("patrol.tokenConfig.enablePatrol.name")}</label>
  <input type="checkbox" name="enablePatrol" data-dtype="Boolean">
</div>
<div class="form-group">
  <label>${game.i18n.localize("patrol.tokenConfig.enableSpotting.name")}</label>
  <input type="checkbox" name="enableSpotting" data-dtype="Boolean">
</div>`;
  const lockrotation = html.find("input[name='lockRotation']");
  const formGroup = lockrotation.closest(".form-group");
  formGroup.after(toggleHTML);
  html.find("input[name ='enablePatrol']")[0].checked =
    app.object.getFlag(MODULE_NAME_PATROL, "enablePatrol") || false;
    html.find("input[name ='enableSpotting']")[0].checked =
    app.object.getFlag(MODULE_NAME_PATROL, "enableSpotting") || false;
  html.find($('button[name="submit"]')).click(app.object, saveTokenConfigPT);
});

async function saveTokenConfigPT(event) {
  let html = this.offsetParent;
  enablePatrol = html.querySelectorAll("input[name ='enablePatrol']")[0]
    .checked;
    enableSpotting = html.querySelectorAll("input[name ='enableSpotting']")[0]
    .checked;
  await event.data.setFlag(MODULE_NAME_PATROL, "enablePatrol", enablePatrol);
  await event.data.setFlag(MODULE_NAME_PATROL, "enableSpotting", enableSpotting);
  _patrol.mapTokens();
}

Hooks.on("createDrawing", () => {
  _patrol.mapTokens();
});

Hooks.on("updateDrawing", () => {
  _patrol.mapTokens();
});

Hooks.on("deleteDrawing", () => {
  _patrol.mapTokens();
});

Hooks.on("createToken", () => {
  _patrol.mapTokens();
});

Hooks.on("deleteToken", () => {
  _patrol.mapTokens();
});