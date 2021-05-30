const MODULE_NAME_PATROL = "patrol"
let _patrol

Hooks.on("canvasReady",()=>{
  if(!game.user.isGM) return
  if(!_patrol) _patrol = Patrol.get()
  _patrol.patrolStart()
})