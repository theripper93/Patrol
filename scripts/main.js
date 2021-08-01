const MODULE_NAME_PATROL = "patrol"
let _patrol
let _pathPatrol
Hooks.on("canvasReady",()=>{
  if(!game.user.isGM) return
  let patrolWasstarted = false
  let pathPatrolWasStarted = false
  if(_patrol) {
    _patrol.patrolStop()
    patrolWasstarted = _patrol.started
  }
  if(_pathPatrol)
  {
    _pathPatrol.stopPatrol()
    pathPatrolWasStarted = _pathPatrol.started
  }
  _patrol = Patrol.get()
  _patrol.started=patrolWasstarted
  _patrol.patrolStop()
  _patrol.patrolStart()
  
  _pathPatrol = PathPatroller.get()
  _pathPatrol.started=pathPatrolWasStarted
  _pathPatrol.stopPatrol()
  _pathPatrol.startPatrol()
})

Hooks.on("patrolSpotted",( token, char)=>{
  _patrolSocket.executeForEveryone("spotted", token.id);
});

Hooks.on("patrolAlerted",( token, char)=>{
  _patrolSocket.executeForEveryone("alerted", token.id);
});