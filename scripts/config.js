let _patrolSocket;

Hooks.once("socketlib.ready", () => {
	_patrolSocket = socketlib.registerModule(MODULE_NAME_PATROL);
	_patrolSocket.register("spotted", patrolSpotted);
  _patrolSocket.register("alerted", patrolAlerted);
});

Hooks.on("getSceneControlButtons", (controls, b, c) => {
  if (game.user.isGM) {
    if (!_patrol) _patrol = Patrol.get();
    if (!_pathPatrol) _pathPatrol = PathPatroller.get();
    basictools = controls.find((x) => x["name"] == "token").tools;
    basictools.push({
      active: _patrol.started,
      icon: "fas fa-walking",
      name: "patrolToggle",
      title: game.i18n.localize("patrol.tools.patrolToggle.hint"),
      onClick: (toggle) => {
        _patrol.started = toggle;
        _pathPatrol.started = toggle;
      },
      toggle: true,
    },
    {
      button: true,
      visible: true,
      icon: "fas fa-draw-polygon",
      name: "remapPatrolPaths",
      title: game.i18n.localize("patrol.tools.remapPatrolPaths.hint"),
      onClick: () => {
        _pathPatrol.mapTokensAndPaths();
        _pathPatrol.resetPathIndex();
      }
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

  /*game.settings.register(MODULE_NAME_PATROL, "patrolSmooth", {
    name: game.i18n.localize("patrol.settings.patrolSmooth.name"),
    hint: game.i18n.localize("patrol.settings.patrolSmooth.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });*/

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

  game.settings.register(MODULE_NAME_PATROL, "pathPatrolDelay", {
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
      _pathPatrol.delay = setting;
    },
  });

  game.settings.register(MODULE_NAME_PATROL, "resetToRandomNode", {
    name: game.i18n.localize("patrol.settings.resetToRandomNode.name"),
    hint: game.i18n.localize("patrol.settings.resetToRandomNode.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  //libWrapper.register(MODULE_NAME_PATROL,"Token.prototype.animateMovement", _patrolAnimateMovement, "OVERRIDE")

});

Hooks.on("renderTokenConfig", (app, html, data) => {
  if (!game.user.isGM) return;
  let toggleHTML = `<div class="form-group">
  <label>${game.i18n.localize("patrol.tokenConfig.enablePatrol.name")}</label>
  <input type="checkbox" name="flags.${MODULE_NAME_PATROL}.enablePatrol" data-dtype="Boolean">
</div>
<div class="form-group">
  <label>${game.i18n.localize("patrol.tokenConfig.enableSpotting.name")}</label>
  <input type="checkbox" name="flags.${MODULE_NAME_PATROL}.enableSpotting" data-dtype="Boolean">
</div>
<div class="form-group">
  <label>${game.i18n.localize("patrol.tokenConfig.makePatroller.name")}</label>
  <input type="checkbox" name="flags.${MODULE_NAME_PATROL}.makePatroller" data-dtype="Boolean">
  <label>${game.i18n.localize("patrol.tokenConfig.multiPath.name")}</label>
  <input type="checkbox" name="flags.${MODULE_NAME_PATROL}.multiPath" data-dtype="Boolean">
</div>
<div class="form-group">
  <label>${game.i18n.localize("patrol.tokenConfig.patrolPathName.name")}</label>
  <input type="text" name="flags.${MODULE_NAME_PATROL}.patrolPathName" value="">
  <label> ${game.i18n.localize("patrol.tokenConfig.pathNodeIndex.name")} </label>
  <input type="text" name="flags.${MODULE_NAME_PATROL}.pathNodeIndex" value="">
</div>
`;
  const lockrotation = html.find("input[name='lockRotation']");
  const formGroup = lockrotation.closest(".form-group");
  formGroup.after(toggleHTML);
  html.find(`input[name ='flags.${MODULE_NAME_PATROL}.enablePatrol']`)[0].checked =
    app.token.getFlag(MODULE_NAME_PATROL, "enablePatrol") || false;
  html.find(`input[name ='flags.${MODULE_NAME_PATROL}.enableSpotting']`)[0].checked =
    app.token.getFlag(MODULE_NAME_PATROL, "enableSpotting") || false;
  html.find(`input[name ='flags.${MODULE_NAME_PATROL}.makePatroller']`)[0].checked = 
    app.token.getFlag(MODULE_NAME_PATROL, "makePatroller") || false;
  html.find(`input[name ='flags.${MODULE_NAME_PATROL}.multiPath']`)[0].checked = 
    app.token.getFlag(MODULE_NAME_PATROL, "multiPath") || false;
  html.find(`input[name = 'flags.${MODULE_NAME_PATROL}.patrolPathName']`)[0].value = 
    app.token.getFlag(MODULE_NAME_PATROL, "patrolPathName") || "";
  html.find(`input[name = 'flags.${MODULE_NAME_PATROL}.pathNodeIndex']`)[0].value = 
    app.token.getFlag(MODULE_NAME_PATROL, "pathNodeIndex") || 0;
  
  app.setPosition({ height: "auto" });
});

Hooks.on("createDrawing", () => {
  if(game.user.isGM) 
  {
    _patrol.mapTokens();
    _pathPatrol.mapTokensAndPaths();

  }
});

Hooks.on("updateDrawing", () => {
  if(game.user.isGM) 
  {
    _patrol.mapTokens();
    _pathPatrol.resetPathIndex();
  }
});

Hooks.on("deleteDrawing", () => {
  if(game.user.isGM) 
  {
    _patrol.mapTokens();
    _pathPatrol.resetPathIndex();
  }
});

Hooks.on("createToken", () => {
  if(game.user.isGM) 
  {
    _patrol.mapTokens();
    _pathPatrol.mapTokensAndPaths();
  }
});

Hooks.on("deleteToken", () => {
  if(game.user.isGM) 
  {
    _patrol.mapTokens();
    _pathPatrol.mapTokensAndPaths();
  }
});

Hooks.on("updateToken", async (tokend,updates) => {
  if(game.user.isGM && updates.flags?.patrol && (updates.flags.patrol.pathNodeIndex == undefined || updates.flags.patrol.pathID == undefined)) 
  {
    let token = canvas.tokens.get(tokend.id);
    if(token.document.getFlag(MODULE_NAME_PATROL, "makePatroller"))
    {
      //console.log(event.data);
      let pathName = token.document.getFlag(MODULE_NAME_PATROL, "patrolPathName");
      let multiPath = token.document.getFlag(MODULE_NAME_PATROL, "multiPath");
      let pathGroup = canvas.drawings.placeables.filter((d) => 
      {if(d.document.text == pathName)
        {
            return d;
        }
      });
      let pathID = "";
      if (pathGroup[0] != undefined)
      {
        if (multiPath)
        {
          pathID = pathGroup[Math.floor(Math.random() * pathGroup.length)].id;
        }
        else
        {
          pathID = pathGroup[0].id;
        }
      }
      await token.document.setFlag(MODULE_NAME_PATROL, "pathID", pathID);
    }
    _pathPatrol.mapTokensAndPaths();
    _patrol.mapTokens();
    _pathPatrol.mapTokensAndPaths();
  }
});