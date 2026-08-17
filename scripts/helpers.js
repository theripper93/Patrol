import { MODULE_ID } from "./main.js";
import { patrolInstances } from "./main.js";

// Types: suspicious => alerted => spotted

export async function patrolAlerted({ uuid, type }) {
    let enemyToken = fromUuidSync(uuid)?.object;

    const config = {};
    if (type === "suspicious") {
        config.mark = "?";
        config.color = "#fff200";
        config.size = 64;
        config.sound = game.settings.get(MODULE_ID, "patrolAlert");
    } else if (type === "alerted") {
        config.mark = "!";
        config.color = "#fff200";
        config.size = 64;
    } else if (type === "spotted") {
        config.pause = true;
        config.mark = "!";
        config.color = "#ff0000";
        config.size = 128;
        config.sound = game.settings.get(MODULE_ID, "patrolSound");
    }

    if (config.pause) {
        game.togglePause(true);
        await canvas.animatePan({
            x: enemyToken.center.x,
            y: enemyToken.center.y,
            scale: 0.8,
        });
    }

    if (config.sound) {
        foundry.audio.AudioHelper.play(
            {
                src: config.sound,
                volume: 0.8,
                loop: false,
            },
            true,
        );
    }

    let mark = new PIXI.Text(config.mark, {
        fontFamily: "Impact",
        strokeThickness: 6,
        fontSize: config.size * enemyToken.document.height,
        fill: config.color,
        align: "center",
    });

    let g = new PIXI.Graphics();
    g.addChild(mark);
    g.x = (enemyToken.document.width * canvas.scene.dimensions.size) / 2 - g.width / 2;
    g.y = -g.height / 2;
    enemyToken.addChild(g);

    function fade() {
        g.alpha -= 0.1;
    }
    setTimeout(() => {
        canvas.app.ticker.add(fade);
    }, 4000);
    setTimeout(() => {
        enemyToken.removeChild(g);
        canvas.app.ticker.remove(fade);
    }, 5000);
}

// export async function patrolSpotted({ uuid, pizzed = false }) {
//     let enemyToken = fromUuidSync(uuid)?.object;
//     if (pizzed) {
//         game.togglePause(true);
//         await canvas.animatePan({
//             x: enemyToken.center.x,
//             y: enemyToken.center.y,
//             scale: 0.8,
//         });
//     }
//     foundry.audio.AudioHelper.play(
//         {
//             src: game.settings.get(MODULE_ID, "patrolSound"),
//             volume: 0.8,
//             loop: false,
//         },
//         true,
//     );
//     let exclamationMark = new PIXI.Text("!", {
//         fontFamily: "Impact",
//         strokeThickness: 6,
//         fontSize: 128 * enemyToken.document.height,
//         fill: pizzed ? 0xff0000 : 0xfff200,
//         align: "center",
//     });
//     let g = new PIXI.Graphics();
//     g.addChild(exclamationMark);
//     g.x = (enemyToken.document.width * canvas.scene.dimensions.size) / 2 - g.width / 2;
//     g.y = -g.height / 2;
//     enemyToken.addChild(g);
//     setTimeout(() => {
//         canvas.app.ticker.add(fade);
//     }, 4000);
//     setTimeout(() => {
//         enemyToken.removeChild(g);
//         canvas.app.ticker.remove(fade);
//     }, 5000);

//     function fade() {
//         g.alpha -= 0.1;
//     }
// }
