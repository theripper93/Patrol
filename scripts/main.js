import {Socket} from "./lib/socket.js";
import { Patrol } from "./patrol.js";
import {PathPatroller} from "./pathPatroller.js";
import { setupHooks } from "./config.js";

export const MODULE_ID = "patrol";



export const patrolInstances = {
  _patrol : undefined,
  _pathPatrol : undefined,
}

setupHooks();

Hooks.on("canvasReady",()=>{
  if(!game.user.isGM) return
  let patrolWasstarted = false
  let pathPatrolWasStarted = false
  if(patrolInstances._patrol) {
    patrolInstances._patrol.patrolStop()
    patrolWasstarted = patrolInstances._patrol.started
  }
  if(patrolInstances._pathPatrol)
  {
    patrolInstances._pathPatrol.stopPatrol()
    pathPatrolWasStarted = patrolInstances._pathPatrol.started
  }
  patrolInstances._patrol = Patrol.get()
  patrolInstances._patrol.started=patrolWasstarted
  patrolInstances._patrol.patrolStop()
  patrolInstances._patrol.patrolStart()
  
  patrolInstances._pathPatrol = PathPatroller.get()
  patrolInstances._pathPatrol.started=pathPatrolWasStarted
  patrolInstances._pathPatrol.stopPatrol()
  patrolInstances._pathPatrol.startPatrol()
})

Hooks.on("patrolSpotted", (token, char) => {
  Socket.spotted({uuid: token.document.uuid});
});

Hooks.on("patrolAlerted", (token, char) =>  {
  Socket.alerted({uuid: token.document.uuid});
});