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
