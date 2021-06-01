async function patrolSpotted(tokenId) {
  game.togglePause(true);
  let enemyToken = canvas.tokens.get(tokenId);
  if(_patrol.DEBUG) console.log("Spotted by:", enemyToken);
  await canvas.animatePan({
    x: enemyToken.center.x,
    y: enemyToken.center.y,
    scale: 0.8,
  });
  AudioHelper.play(
    {
      src: game.settings.get(MODULE_NAME_PATROL, "patrolSound"),
      volume: 0.8,
      loop: false,
    },
    true
  );
  let exclamationMark = new PIXI.Text("!", {
    fontFamily: "Impact",
    strokeThickness: 6,
    fontSize: 128*enemyToken.data.height,
    fill: 0xff0000,
    align: "center",
  });
  let g = new PIXI.Graphics();
  g.addChild(exclamationMark);
  g.x =
    enemyToken.x +
    (enemyToken.data.width * canvas.scene.dimensions.size) / 2 -
    g.width / 2;
  g.y = enemyToken.y - g.height / 2;
  canvas.foreground.addChild(g);
  setTimeout(() => {
    canvas.app.ticker.add(fade);
  }, 4000);
  setTimeout(() => {
    canvas.foreground.removeChild(g);
    canvas.app.ticker.remove(fade);
  }, 5000);

  function fade() {
    g.alpha -= 0.1;
  }
}

async function patrolAlerted(tokenId) {
  let enemyToken = canvas.tokens.get(tokenId);
  if(_patrol.DEBUG) console.log("Allerted:", enemyToken);
  AudioHelper.play(
    {
      src: game.settings.get(MODULE_NAME_PATROL, "patrolAlert"),
      volume: 0.8,
      loop: false,
    },
    true
  );
  let exclamationMark = new PIXI.Text("?", {
    fontFamily: "Impact",
    strokeThickness: 6,
    fontSize: 64*enemyToken.data.height,
    fill: 0xfff200,
    align: "center",
  });
  let pADelay = game.settings.get(MODULE_NAME_PATROL, "patrolAlertDelay")
  let g = new PIXI.Graphics();
  g.addChild(exclamationMark);
  g.x =
    (enemyToken.data.width * canvas.scene.dimensions.size) / 2 -
    g.width / 2;
  g.y = - g.height / 2;
  enemyToken.addChild(g);
  setTimeout(() => {
    canvas.app.ticker.add(fade);
  }, pADelay/5*4);
  setTimeout(() => {
    enemyToken.removeChild(g);
    canvas.app.ticker.remove(fade);
  }, pADelay);

  function fade() {
    g.alpha -= (pADelay-pADelay/5*4)/10000
  }
}

async function _patrolAnimateMovement(ray) {
  // Move distance is 10 spaces per second
  const s = canvas.dimensions.size;
  this._movement = ray;
  const speed = s * 10;
  const duration = this.document.getFlag(MODULE_NAME_PATROL, "enablePatrol") && !this._controlled ? _patrol.delay : (ray.distance * 1000) / speed;

  // Define attributes
  const attributes = [
    { parent: this, attribute: 'x', to: ray.B.x },
    { parent: this, attribute: 'y', to: ray.B.y }
  ];

  // Determine what type of updates should be animated
  const emits = this.emitsLight;
  const config = {
    animate: game.settings.get("core", "visionAnimation"),
    source: this._isVisionSource() || emits,
    sound: this._controlled || this.observer,
    fog: emits && !this._controlled && (canvas.sight.sources.size > 0)
  }

  // Dispatch the animation function
  let animationName = `Token.${this.id}.animateMovement`;
  await CanvasAnimation.animateLinear(attributes, {
    name: animationName,
    context: this,
    duration: duration,
    ontick: (dt, anim) => this._onMovementFrame(dt, anim, config)
  });

  // Once animation is complete perform a final refresh
  if ( !config.animate ) this._animatePerceptionFrame({source: config.source, sound: config.sound});
  this._movement = null;
}