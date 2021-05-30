class Patrol {
  constructor() {
    this.tokens = [];
    this.characters = [];
    this.executePatrol = false;
    this.started = false
    this.delay = game.settings.get(MODULE_NAME_PATROL, "patrolDelay") || 2500
    this.DEBUG = false
  }

  static get() {
    return new Patrol();
  }

  mapTokens() {
    let patrolDrawings = canvas.drawings.placeables.filter(d => d.data.text == "Patrol" && d.data.points.length != 0)
    this.tokens = []
    canvas.tokens.placeables.filter(t => t.document.getFlag(MODULE_NAME_PATROL, "enablePatrol")).forEach((t) => {
      let tokenDrawing
      for(let drawing of patrolDrawings){
        let p = new PIXI.Polygon(this.adjustPolygonPoints(drawing))
        if(p.contains(t.center.x,t.center.y)) tokenDrawing = p
      }
      this.tokens.push({ tokenDocument: t, visitedPositions: [`${t.x}-${t.y}`], patrolPolygon: tokenDrawing,canSpot: t.document.getFlag(MODULE_NAME_PATROL, "enableSpotting") });
    });
    this.characters = canvas.tokens.placeables.filter(t => t.actor.type == "character")
  }

  async patrolSetDelay(ms) {
    setTimeout(() => {
      this.executePatrol = true; 
    }, ms);
  }

  patrolStart() {
    this.mapTokens();
    this.patrolSetDelay(this.delay)
    canvas.app.ticker.add(this.patrolCompute);
  }

  async patrolCompute() {
    if (_patrol.executePatrol && !game.paused && !game.combat && _patrol.started) {

      let perfStart,perfEnd
      if(_patrol.DEBUG) perfStart = performance.now()

      _patrol.executePatrol = false;
      _patrol.patrolSetDelay(_patrol.delay);
      let updates = [];
      for(let token of _patrol.tokens){
        if(token.canSpot && _patrol.detectPlayer(token)){
          _patrolSocket.executeForEveryone("spotted", token.tokenDocument.id);
          continue
        }
        if(token.tokenDocument._controlled) continue
        let validPositions = _patrol.getValidPositions(token);
        let newPosition =
          validPositions[Math.round(Math.random() * (validPositions.length-1))];
        if(validPositions.length != 0){
          updates.push({ _id: token.tokenDocument.id, x: newPosition.x,y: newPosition.y });
          token.visitedPositions.push(`${newPosition.x}-${newPosition.y}`);
        } else{
          token.visitedPositions = [`${token.tokenDocument.x}-${token.tokenDocument.y}`]
        }
      }
      canvas.scene.updateEmbeddedDocuments("Token", updates);

      if(_patrol.DEBUG){
        perfEnd = performance.now()
        console.log(`Patrol compute took ${perfEnd-perfStart} ms, FPS:${Math.round(canvas.app.ticker.FPS)}`)
      } 

    }
  }

  getValidPositions(token) {
    let validPositions = [];
    this.getDirections(token.tokenDocument).forEach((d) => {
      if (!token.visitedPositions.includes(`${d.x}-${d.y}`) && (!token.patrolPolygon || token.patrolPolygon.contains(d.center.x,d.center.y)) && !canvas.walls.checkCollision(new Ray(token.tokenDocument.center, d.center)))
        validPositions.push(d);
    });
    return validPositions;
  }

  getDirections(token) {
    let g = canvas.dimensions.size;
    return [
      { x: token.x + g, y: token.y,center:{x: token.center.x + g, y: token.center.y} },
      { x: token.x - g, y: token.y,center:{x: token.center.x - g, y: token.center.y}  },
      { x: token.x, y: token.y + g,center:{x: token.center.x, y: token.center.y + g}  },
      { x: token.x, y: token.y - g,center:{x: token.center.x, y: token.center.y - g}  },
    ];
  }

  adjustPolygonPoints(drawing){
    let globalPoints = []
    drawing.data.points.forEach((p)=> {
      globalPoints.push(p[0]+drawing.x,p[1]+drawing.y)
    })
    return globalPoints
  }

  detectPlayer(token){
    let maxDistance = canvas.scene.data.globalLight ? 1000 : Math.max(token.tokenDocument.data.dimSight,token.tokenDocument.data.brightSight)
    for(let char of this.characters){
      if(canvas.grid.measureDistance(token.tokenDocument.center,char.center)*canvas.scene.dimensions.distance <= maxDistance && !canvas.walls.checkCollision(new Ray(token.tokenDocument.center,char.center),{type:"sight"})){
        game.togglePause(true)
        return true
      }
    }
    return false
  }
}