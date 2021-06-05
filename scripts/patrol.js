class Patrol {
  constructor() {
    this.tokens = [];
    this.characters = [];
    this.executePatrol = false;
    this.started = false;
    this.delay = game.settings.get(MODULE_NAME_PATROL, "patrolDelay") || 2500;
    this.diagonals = game.settings.get(MODULE_NAME_PATROL, "patrolDiagonals") || false
    this.DEBUG = false;
  }

  static get() {
    return new Patrol();
  }

  mapTokens() {
    let patrolDrawings = canvas.drawings.placeables.filter(
      (d) => d.data.text == "Patrol" && d.data.points.length != 0
    );
    this.tokens = [];
    canvas.tokens.placeables
      .filter((t) => t.document.getFlag(MODULE_NAME_PATROL, "enablePatrol"))
      .forEach((t) => {
        let tokenDrawing;
        for (let drawing of patrolDrawings) {
          let p = new PIXI.Polygon(this.adjustPolygonPoints(drawing));
          if (p.contains(t.center.x, t.center.y)) tokenDrawing = p;
        }
        this.tokens.push({
          tokenDocument: t,
          visitedPositions: [`${t.x}-${t.y}`],
          patrolPolygon: tokenDrawing,
          canSpot: t.document.getFlag(MODULE_NAME_PATROL, "enableSpotting"),
          alerted:false,
          alertTimedOut:false,
          spottedToken: undefined
        });
      });
    this.characters = canvas.tokens.placeables.filter(
      (t) => t.actor && t.actor.type == "character"
    );
  }

  async patrolSetDelay(ms) {
    setTimeout(() => {
      this.executePatrol = true;
    }, ms);
  }

  async patrolAlertTimeout(ms,token) {
    setTimeout(() => {
      token.alertTimedOut = true;
      token.alerted = false;
    }, ms);
  }

  patrolStart() {
    this.mapTokens();
    this.patrolSetDelay(this.delay);
    canvas.app.ticker.add(this.patrolCompute);
  }

  patrolStop() {
    canvas.app.ticker.remove(this.patrolCompute);
  }

  patrolCompute() {
    if (
      _patrol.executePatrol &&
      !game.paused &&
      !game.combat?.started &&
      _patrol.started
    ) {
      let perfStart, perfEnd;
      if (_patrol.DEBUG) perfStart = performance.now();

      _patrol.executePatrol = false;
      _patrol.patrolSetDelay(_patrol.delay);
      let updates = [];
      let occupiedPositions = [];
      _patrol.tokens.filter(token => token.canSpot && _patrol.detectPlayer(token,true) && (!token.alerted || canvas.grid.measureDistance(token.tokenDocument.center, token.spottedToken.center)<10)).forEach((token)=>{
        occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`)
      })
      for (let token of _patrol.tokens) {
        if(token.spottedToken)occupiedPositions.push(`${token.spottedToken.x}-${token.spottedToken.y}`)
        if (token.canSpot && _patrol.detectPlayer(token) && (!token.alerted || canvas.grid.measureDistance(token.tokenDocument.center, token.spottedToken.center)<10)) {
            //occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`)
            continue;
        }
        if (token.tokenDocument._controlled) continue;
        let validPositions = _patrol.getValidPositions(token,occupiedPositions);
        let newPosition =
          validPositions[
            Math.round(Math.random() * (validPositions.length - 1))
          ];
        if (validPositions.length != 0) {
          updates.push({
            _id: token.tokenDocument.id,
            x: newPosition.x,
            y: newPosition.y,
          });
          token.visitedPositions.push(`${newPosition.x}-${newPosition.y}`);
          occupiedPositions.push(`${newPosition.x}-${newPosition.y}`)
        } else {
          token.visitedPositions = [
            `${token.tokenDocument.x}-${token.tokenDocument.y}`,
          ];
          occupiedPositions.push(`${token.tokenDocument.x}-${token.tokenDocument.y}`)
        }
      }
      canvas.scene.updateEmbeddedDocuments("Token", updates);

      if (_patrol.DEBUG) {
        perfEnd = performance.now();
        console.log(
          `Patrol compute took ${perfEnd - perfStart} ms, FPS:${Math.round(
            canvas.app.ticker.FPS
          )}`
        );
      }
    }
  }

  getValidPositions(token,occupiedPositions) {
    let validPositions = [];
    this.getDirections(token.tokenDocument).forEach((d) => {
      if (
        !token.visitedPositions.includes(`${d.x}-${d.y}`) &&
        !occupiedPositions.includes(`${d.x}-${d.y}`) &&
        (!token.patrolPolygon ||
          token.patrolPolygon.contains(d.center.x, d.center.y)) &&
        !canvas.walls.checkCollision(
          new Ray(token.tokenDocument.center, d.center)
        )
      )
        validPositions.push(d);
    });
    if(token.alerted && validPositions.length != 0){
      const reducer = (previousPoint, currentPoint) => {
          return canvas.grid.measureDistance(currentPoint.center, token.spottedToken.center) <
            canvas.grid.measureDistance(previousPoint.center,  token.spottedToken.center)
            ? currentPoint
            : previousPoint;
      };
      return [validPositions.reduce(reducer)]
    }
    return validPositions;
  }

  getDirections(token) {
    let g = canvas.dimensions.size;
    let positions = [
      {
        x: token.x + g,
        y: token.y,
        center: { x: token.center.x + g, y: token.center.y },
      },
      {
        x: token.x - g,
        y: token.y,
        center: { x: token.center.x - g, y: token.center.y },
      },
      {
        x: token.x,
        y: token.y + g,
        center: { x: token.center.x, y: token.center.y + g },
      },
      {
        x: token.x,
        y: token.y - g,
        center: { x: token.center.x, y: token.center.y - g },
      },
    ];
    if(this.diagonals)positions.push({
      x: token.x + g,
      y: token.y + g,
      center: { x: token.center.x + g, y: token.center.y + g },
    },
    {
      x: token.x - g,
      y: token.y - g,
      center: { x: token.center.x - g, y: token.center.y-g },
    },
    {
      x: token.x - g,
      y: token.y + g,
      center: { x: token.center.x - g, y: token.center.y + g },
    },
    {
      x: token.x + g,
      y: token.y - g,
      center: { x: token.center.x + g, y: token.center.y - g },
    })
    return positions
  }

  adjustPolygonPoints(drawing) {
    let globalPoints = [];
    drawing.data.points.forEach((p) => {
      globalPoints.push(p[0] + drawing.x, p[1] + drawing.y);
    });
    return globalPoints;
  }

  detectPlayer(token,preventEvent=false) {
    let maxDistance = canvas.scene.data.globalLight
      ? 1000
      : Math.max(
          token.tokenDocument.data.dimSight,
          token.tokenDocument.data.brightSight
        );
    for (let char of this.characters) {
      if (
        canvas.grid.measureDistance(token.tokenDocument.center, char.center) <=
          maxDistance &&
        !canvas.walls.checkCollision(
          new Ray(token.tokenDocument.center, char.center),
          { type: "sight" }
        )
      ) {
        if(preventEvent) return true
        let spotter = token.tokenDocument;
        let spotted = char;
        if(game.settings.get(MODULE_NAME_PATROL, "patrolAlertDelay") == 0){
          token.alerted=true
          token.alertTimedOut=true
        }
        if(!token.alerted && !token.alertTimedOut){
        // Allow a system / module to override if something was spotted
        if (Hooks.call("prePatrolAlerted", spotter, spotted)) {
          token.alerted=true
          token.spottedToken = spotted
          this.patrolAlertTimeout(game.settings.get(MODULE_NAME_PATROL, "patrolAlertDelay"),token)
          // Inform any who want to do something with the spotted info
          Hooks.callAll("patrolAlerted", spotter, spotted);
        }
        }else if(token.alertTimedOut){
        // Allow a system / module to override if something was spotted
        if (Hooks.call("prePatrolSpotted", spotter, spotted)) {
          token.alerted=false
          token.alertTimedOut=false
          token.spottedToken = undefined
          // Inform any who want to do something with the spotted info
          Hooks.callAll("patrolSpotted", spotter, spotted);
        }
        }
        
        return true;
      }
    }
    if(preventEvent) return false
    token.alertTimedOut=false
    return false;
  }

  
}
