export class Propagator {
    static getSnappedPositionFromTokenData(position, td) {
        const tokenLayer = canvas.tokens;
        const object = tokenLayer.createObject(td);
        return object.getSnappedPosition(position);
    }
    // Find a non-occupied cell in the grid that matches the size of the token given an origin
  static getFreePosition(tokenData, origin, collision = true) {
      const tokenDocument = new CONFIG.Token.documentClass(tokenData ?? {}, { parent: canvas.scene });
      origin = canvas.grid.getCenterPoint(origin);
        const positions = Propagator.generatePositions(origin, tokenDocument);
        for (let position of positions) {
            if (Propagator.canFit(tokenDocument, position, positions[0], collision)) {
                return position;
            }
        }
    }
    //generate positions radiantially from the origin
    static generatePositions(origin, tokenDocument) {
      const positions = [Propagator.getSnappedPositionFromTokenData({ x: origin.x - 1, y: origin.y - 1 }, tokenDocument)];
        for (let r = canvas.scene.dimensions.size; r < canvas.scene.dimensions.size * 10; r += canvas.scene.dimensions.size) {
            for (let theta = 0; theta < 2 * Math.PI; theta += Math.PI / ((4 * r) / canvas.scene.dimensions.size)) {
                const newPos = Propagator.getSnappedPositionFromTokenData({ x: origin.x + r * Math.cos(theta), y: origin.y + r * Math.sin(theta) }, tokenDocument);
                positions.push(newPos );
            }
        }
        return positions;
    }
    //check if a position is free
    static isFree(position) {
        for (let token of canvas.tokens.placeables) {
            const hitBox = new PIXI.Rectangle(token.document.x, token.document.y, token.document.width * canvas.scene.dimensions.size, token.document.height * canvas.scene.dimensions.size);
            if (hitBox.contains(position.x, position.y)) {
                return false;
            }
        }
        return true;
    }
    //check if a token can fit in a position
    static canFit(tokenData, position, origin, collision) {
        for (let i = 0; i < tokenData.width; i++) {
            for (let j = 0; j < tokenData.height; j++) {
                const x = position.x + j * canvas.scene.dimensions.size;
                const y = position.y + i * canvas.scene.dimensions.size;
                if (!Propagator.isFree({ x, y })) {
                    return false;
                }
            }
        }
        const wallCollisions =
            CONFIG.Canvas.polygonBackends.move.testCollision(
                origin,
                {
                    x: position.x + tokenData.width / 2,
                    y: position.y + tokenData.height / 2,
                },
                { type: "move" },
            )?.length ?? 0;

        return !collision || !wallCollisions;
    }
}
