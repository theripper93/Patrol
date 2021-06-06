# Patrol
Automatic Patrol Routes for NPCs

![Latest Release Download Count](https://img.shields.io/github/downloads/theripper93/Patrol/latest/module.zip?color=2b82fc&label=DOWNLOADS&style=for-the-badge) [![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpatrol&colorB=03ff1c&style=for-the-badge)](https://forge-vtt.com/bazaar#package=patrol) ![Foundry Core Compatible Version](https://img.shields.io/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftheripper93%2FPatrol%2Fmain%2Fmodule.json&label=Foundry%20Version&query=$.compatibleCoreVersion&colorB=orange&style=for-the-badge) [![alt-text](https://img.shields.io/badge/-Patreon-%23ff424d?style=for-the-badge)](https://www.patreon.com/theripper93) [![alt-text](https://img.shields.io/badge/-Discord-%235662f6?style=for-the-badge)](https://discord.gg/V9YD94AeY3)

**Patrol Options**:

* **Enable Patrol:** If enabled the token will patrol

* **Spot Player Characters:** If enabled the token will spot player characters, pausing the game and panning on the token when spotting

**Alerting**:

* When a player is spotted a question mark will appear on top of the enemy token wich will then try to chase the intruder.
* After a set time has passed the token will be spotted. You can configure sad time in the module settings. If the alert time is set to 0 the character will be immediately spotted

**Custom Patrols**

You can have a token patrol a specific area by drawing a Polygon or Rectangle (other shapes are not supported) and in it's text propriety call it "Patrol" (upper case P). Any token in that area will patrol only inside that area

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

![alt text](https://github.com/theripper93/Patrol/raw/main/wiki/patrolconfig.jpg)


![alt text](https://github.com/theripper93/Patrol/raw/main/wiki/patrolspot.jpg)
