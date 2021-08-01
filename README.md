# Patrol
Automatic Patrol Routes for NPCs

![Latest Release Download Count](https://img.shields.io/github/downloads/theripper93/Patrol/latest/module.zip?color=2b82fc&label=DOWNLOADS&style=for-the-badge) [![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpatrol&colorB=03ff1c&style=for-the-badge)](https://forge-vtt.com/bazaar#package=patrol) ![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftheripper93%2FPatrol%2Fmain%2Fmodule.json&label=Foundry%20Version&query=$.compatibleCoreVersion&colorB=orange&style=for-the-badge) [![alt-text](https://img.shields.io/badge/-Patreon-%23ff424d?style=for-the-badge)](https://www.patreon.com/theripper93) [![alt-text](https://img.shields.io/badge/-Discord-%235662f6?style=for-the-badge)](https://discord.gg/F53gBjR97G)

**Patrol Options**:

* **Enable Random Patrol:** If enabled the token will patrol randomly 
> **THIS OPTION IS MUTUALLY EXCLUSIVE TO "Enable Path patrol"**

* **Spot Player Characters:** If enabled the token will spot player characters, pausing the game and panning on the token when spotting

* **Enable Path Patrol:** If enabled the token will follow the given path/paths 
> **THIS OPTION IS MUTUALLY EXCLUSIVE TO "Enable Random patrol"**

* **Use Multiple paths:** If enabled the token will use multiple paths

* **Patrol Path:** The name of the path/s that the token will follow if patrolling paths

* **Path Node:** The node of the path at which the token is currently on. This setting can be changed to start tokens mid-way through paths.

**Alerting**:

* When a player is spotted a question mark will appear on top of the enemy token wich will then try to chase the intruder.
* After a set time has passed the token will be spotted. You can configure sad time in the module settings. If the alert time is set to 0 the character will be immediately spotted

**Custom Patrols**

You can have a token patrol a specific area by drawing a Polygon or Rectangle (other shapes are not supported) and in it's text property call it "Patrol" (upper case P). Any token in that area will patrol only inside that area

You can also draw a Polygon or Rectangle, and in it's text property include the word "Path" (upper case P) to select the drawing as a path for patrolling tokens. You may add to the word, but it must include the word "Path" somewhere. (eg. GuardPathA, GuardPathB). A token set to patrol a path will reset back to the begginning of the path once it has finished unless "Use Multiple Paths" is checked. 

Please ensure that only one of the patrol types is checked in the token config.

**Using Multiple Paths**

If the "Use Multiple Paths" checkbox is enabled in the token config, You can draw multiple paths with the same name. The token will randomly select one of the other paths with the same name when it has finished patrolling its current path. It will give preference to paths that are not currently being patrolled by any tokens. 

It is often a good idea to hit the "Remap paths and Reset Nodes" button after making any changes to any paths or patrolling tokens. This will reset the token's path node to either 0, or to a random path and node within the group if the "Reset to Random Node" is checked.

**Auto Rotate**

Patrol is compatible with the Auto Rotate module. Combine them for auto rotating patrols!

**Patrol is not working!**

If patrol is not working, check this steps before opening an issue:

* If a token is selected it will stop patroling
* If you create a combat encounter the patrol will stop
* If you have the game paused, the patrol will stop
* If you haven't toggled the patrol button the patrol will not start

**Module\System\Macro Integration**

You can use Patrol's hooks to enable additional features. Use the hooks:
* "prePatrolSpotted", (spotter, spotted)
* "patrolSpotted", (spotter, spotted)
* "prePatrolAlerted", (spotter, spotted)
* "patrolAlerted", (spotter, spotted)

Example:

```js
Hooks.on("prePatrolSpotted", (spotter, spotted) => {
  // Only actually spotted if the Spotter has a higher passive perception than the target's DC
  return spotter.passivePerception >= spotted.passiveDC;
});
```
```js
Hooks.on("patrolSpotted", (spotter, spotted) => {
  // Start a new combat if needed, then add the spotter to the spotted with a surprise round
});
```
# Video Tutorial by *Check the Rulebook*

[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/Izx441zjtBs/0.jpg)](https://www.youtube.com/watch?v=Izx441zjtBs)

**Patrol Toggle**

![alt text](https://github.com/theripper93/Patrol/raw/main/wiki/patroltoggle.jpg)

**Patrol Token Config**

![alt text](https://github.com/Vauryx/Patrol/blob/pathPatroller/wiki/patrolconfig.jpg)

**Single Path Use**
![alt text](https://github.com/Vauryx/Patrol/blob/pathPatroller/wiki/Single_Path.gif)

**Multiple Paths Use**
![alt text](https://github.com/Vauryx/Patrol/blob/pathPatroller/wiki/Multi_path.gif)

![alt text](https://github.com/theripper93/Patrol/raw/main/wiki/patrolspot.jpg)
