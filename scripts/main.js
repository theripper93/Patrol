const MODULE_NAME_PATROL = "patrol"
let _patrol

Hooks.on("canvasReady",()=>{
  if(!game.user.isGM) return
  let patrolWasstarted = false
  if(_patrol) {
    _patrol.patrolStop()
    patrolWasstarted = _patrol.started
  }
  _patrol = Patrol.get()
  _patrol.started=patrolWasstarted
  _patrol.patrolStop()
  _patrol.patrolStart()
})

Hooks.on("patrolSpotted",( token, char)=>{
  _patrolSocket.executeForEveryone("spotted", token.id);
});

Hooks.on("patrolAlerted",( token, char)=>{
  _patrolSocket.executeForEveryone("alerted", token.id);
});