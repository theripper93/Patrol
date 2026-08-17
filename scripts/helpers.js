import { MODULE_ID } from "./main.js";
import { patrolInstances } from "./main.js";

export async function patrolAlerted({ uuid }) {
    let enemyToken = fromUuidSync(uuid)?.object;
    foundry.audio.AudioHelper.play(
        {
            src: game.settings.get(MODULE_ID, "patrolAlert"),
            volume: 0.8,
            loop: false,
        },
        true,
    );
    let exclamationMark = new PIXI.Text("?", {
        fontFamily: "Impact",
        strokeThickness: 6,
        fontSize: 64 * enemyToken.document.height,
        fill: 0xfff200,
        align: "center",
    });
    let pADelay = game.settings.get(MODULE_ID, "patrolAlertDelay");
    let g = new PIXI.Graphics();
    g.addChild(exclamationMark);
    g.x = (enemyToken.document.width * canvas.scene.dimensions.size) / 2 - g.width / 2;
    g.y = -g.height / 2;
    enemyToken.addChild(g);
    setTimeout(() => {
        canvas.app.ticker.add(fade);
    }, (pADelay / 5) * 4);
    setTimeout(() => {
        enemyToken.removeChild(g);
        canvas.app.ticker.remove(fade);
    }, pADelay);

    function fade() {
        g.alpha -= (pADelay - (pADelay / 5) * 4) / 10000;
    }
}

export async function patrolSpotted({ uuid, pizzed = false }) {
    let enemyToken = fromUuidSync(uuid)?.object;
    if (pizzed) {
        game.togglePause(true);
        await canvas.animatePan({
            x: enemyToken.center.x,
            y: enemyToken.center.y,
            scale: 0.8,
        });
    }
    foundry.audio.AudioHelper.play(
        {
            src: game.settings.get(MODULE_ID, "patrolSound"),
            volume: 0.8,
            loop: false,
        },
        true,
    );
    let exclamationMark = new PIXI.Text("!", {
        fontFamily: "Impact",
        strokeThickness: 6,
        fontSize: 128 * enemyToken.document.height,
        fill: pizzed ? 0xff0000 : 0xfff200,
        align: "center",
    });
    let g = new PIXI.Graphics();
    g.addChild(exclamationMark);
    g.x = (enemyToken.document.width * canvas.scene.dimensions.size) / 2 - g.width / 2;
    g.y = -g.height / 2;
    enemyToken.addChild(g);
    setTimeout(() => {
        canvas.app.ticker.add(fade);
    }, 4000);
    setTimeout(() => {
        enemyToken.removeChild(g);
        canvas.app.ticker.remove(fade);
    }, 5000);

    function fade() {
        g.alpha -= 0.1;
    }
}
