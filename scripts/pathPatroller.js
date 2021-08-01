class PathPatroller 
{
    constructor() 
    {
      this.tokens = [];
      this.executePatrol = false;
      this.started = false;
      this.delay = game.settings.get(MODULE_NAME_PATROL, "pathPatrolDelay") || 2500;
      this.pathCoords = [];
      this.pathsInUse = [];
      //this.justReset = [];
    }

    static get()
    {
        return new PathPatroller();
    }
    async patrolSetDelay(ms) {
        setTimeout(() => {
          this.executePatrol = true;
        }, ms);
      }

    startPatrol()
    {   
        //console.log("Starting patrols...")
        this.mapTokensAndPaths();
        this.patrolSetDelay(this.delay);
        canvas.app.ticker.add(this.doPatrol);
    }

    async resetPathIndex()
    {
        this.mapTokensAndPaths;
        let resetToRandomNode = game.settings.get(MODULE_NAME_PATROL, "resetToRandomNode") || false;
        let patrolPath;
        for (let token of this.tokens)
        {
            if (this.pathCoords != undefined)
            {
                let pathName = token.tokenDocument.document.getFlag(MODULE_NAME_PATROL, "patrolPathName");
                let patrolPathGroup = canvas.drawings.placeables.filter((d) => d.data.text.includes(pathName));
                let patrolPathIndex = Math.floor(Math.random() * patrolPathGroup.length);
                if(patrolPathGroup[patrolPathIndex] != undefined)
                {
                    let pathID = patrolPathGroup[patrolPathIndex].document.id;
                    patrolPath = this.pathCoords.filter((coordSet) => 
                    {
                        if(coordSet.patrolPath.includes(pathID))
                        {
                            return coordSet;
                        }
                    });
                    if(resetToRandomNode)
                    {
                        await token.tokenDocument.document.setFlag(MODULE_NAME_PATROL, "pathID", pathID);
                        await token.tokenDocument.document.setFlag(MODULE_NAME_PATROL, "pathNodeIndex", Number(Math.floor(Math.random() * patrolPath.length)));
                    }
                    else
                    {
                        await token.tokenDocument.document.setFlag(MODULE_NAME_PATROL, "pathNodeIndex", 0);
                    }       
                }
                
            }
                
        }
        
    }
    
    stopPatrol()
    {
        canvas.app.ticker.remove(this.doPatrol);
    }

    async doPatrol()
    {
        if (_pathPatrol.executePatrol && !game.paused && !game.combat?.started && _pathPatrol.started && _pathPatrol.pathCoords[0] != undefined) 
        {
            _pathPatrol.executePatrol = false;
            _pathPatrol.patrolSetDelay(_pathPatrol.delay);
            let updates = [];
            let pathName = "";
            let pathID = "";
            let patrolPath = [];
            let patrolPathGroup = [];
            let isMultiPath = false;
            var currentPathIndex = 0;
            let name = "";
            let id = "";
            let nextPathID = "";
            for (let token of _pathPatrol.tokens) 
            {
                name = token.tokenDocument.data.name;
                id = token.tokenDocument.id;
                isMultiPath = false;
                currentPathIndex = await Number(token.tokenDocument.document.getFlag(MODULE_NAME_PATROL, "pathNodeIndex")); 
                if (token.tokenDocument._controlled) 
                {
                    continue;
                }
                if (_pathPatrol.pathCoords != undefined)
                {
                    pathName = token.tokenDocument.document.getFlag(MODULE_NAME_PATROL, "patrolPathName");

                    if(token.tokenDocument.document.getFlag(MODULE_NAME_PATROL, "multiPath"))
                    {
                        isMultiPath = true;
                        patrolPathGroup = canvas.drawings.placeables.filter((d) => d.data.text.includes(pathName));
                    }
                    
                    pathID = token.tokenDocument.document.getFlag(MODULE_NAME_PATROL, "pathID");
                    patrolPath = _pathPatrol.pathCoords.filter((coordSet) => 
                    {
                        if(coordSet.patrolPath.includes(pathID))
                        {
                            return coordSet;
                        }
                    });
                }
                /*console.log("Starting log for " + name + " with id - " + id + " ---------------------------------------------------");
                console.log("currentPathIndex: " + currentPathIndex);
                console.log("pathName: " + pathName);
                console.log("pathID: " + pathID);
                console.log("patrolPath: ");
                console.log(patrolPath);
                console.log("Moving from {x: " + token.tokenDocument.data.x + ", y: " + token.tokenDocument.data.y + "} to {x: " + patrolPath[currentPathIndex].x
                                + ", y: " + patrolPath[currentPathIndex].y + "}");*/
                if(patrolPath[currentPathIndex] != undefined)
                {
                    updates.push({
                        _id: token.tokenDocument.document.id,
                        x: patrolPath[currentPathIndex].x,
                        y: patrolPath[currentPathIndex].y,
                    });
                }
                
                if (currentPathIndex >= patrolPath.length-1)
                {
                    //console.log("Moved to last node - resetting...")
                    currentPathIndex = 0;
                    if(isMultiPath)
                    {
                        //console.log("Multiple paths detected");
                        let nextPatrolPathIndex = 0;
                        //console.log("Suggested next path index: " + nextPatrolPathIndex);
                        if(patrolPathGroup.length > 1)
                        {
                            nextPathID = patrolPathGroup[nextPatrolPathIndex].document.id;
                            //console.log("Suggested next path ID: " + nextPathID);
                            let infiniteCatch = 0;
                            let unusedPathFound = false;
                            //console.log(patrolPathGroup);
                            for(nextPatrolPathIndex = 0; nextPatrolPathIndex <= patrolPathGroup.length-1; nextPatrolPathIndex ++)
                            {
                                //console.log("Trying to find unused path: " + nextPatrolPathIndex);
                                patrolPath = patrolPathGroup[nextPatrolPathIndex];
                                if(! _pathPatrol.pathsInUse.includes(patrolPath.id))
                                {
                                    //console.log("Found unsed path: " + patrolPath.id);
                                    nextPathID = patrolPath.id;
                                    unusedPathFound = true;
                                    break;
                                }
                            }
                            if(!unusedPathFound)
                            {
                                //console.log("Unsed path not found - picking random new path that is not current");
                                nextPatrolPathIndex = Math.floor(Math.random() * patrolPathGroup.length);
                                //console.log("Suggested next path index: " + nextPatrolPathIndex);
                                nextPathID = patrolPathGroup[nextPatrolPathIndex].document.id;
                                //console.log("Suggested next path ID: " + nextPathID);
                                while((pathID == patrolPathGroup[nextPatrolPathIndex].id && infiniteCatch < (patrolPathGroup.length*2)))
                                {
                                    //console.log(pathID + " is the current path! Picking new path...");
                                    nextPatrolPathIndex = Math.floor(Math.random() * patrolPathGroup.length);
                                    nextPathID = patrolPathGroup[nextPatrolPathIndex].document.id;
                                    infiniteCatch +=1;
                                }
                            }
                            //console.log("Selected next path index: " + nextPatrolPathIndex);
                            //console.log("Selected next path ID: " + nextPathID);
                        }
                        //console.log("Paths currently in use: ");
                        //console.log(_pathPatrol.pathsInUse);
                        //console.log("Removing path " + pathID + " from used list...");
                        let pathIndexToRemove;
                        while(_pathPatrol.pathsInUse.includes(pathID))
                        {
                            pathIndexToRemove = _pathPatrol.pathsInUse.indexOf(pathID);
                            _pathPatrol.pathsInUse.splice(pathIndexToRemove, 1);
                        }
            
                        
                        //console.log("Adding path " + nextPathID + " to used list...");
                        if(!_pathPatrol.pathsInUse.includes(nextPathID))
                        {
                            _pathPatrol.pathsInUse.push(nextPathID);
                        }
                        
                        //console.log("Updating pathID flag to " + patrolPathGroup[nextPatrolPathIndex].document.id);
                        await token.tokenDocument.document.setFlag(MODULE_NAME_PATROL, "pathID", nextPathID);
                    }
                    
                }
                else
                {
                    currentPathIndex += 1;
                }
                //console.log("Updating pathIndex flag to " + currentPathIndex);
                await token.tokenDocument.document.setFlag(MODULE_NAME_PATROL, "pathNodeIndex", Number(currentPathIndex));
                
            }
            
            canvas.scene.updateEmbeddedDocuments("Token", updates);
            
        }

    }

    mapTokensAndPaths() 
    {
        console.log("Mapping tokens");   
        this.pathsInUse = [];  
        this.tokens = [];
        canvas.tokens.placeables.filter((t) => t.document.getFlag(MODULE_NAME_PATROL, "makePatroller")).forEach((t) => {
            this.tokens.push({tokenDocument: t});
            let pathID = t.document.getFlag(MODULE_NAME_PATROL, "pathID");

            if(!this.pathsInUse.includes(pathID))
            {
                this.pathsInUse.push(pathID);
            }
        });

        console.log("Mapping Paths");
        this.pathCoords = [];
        canvas.drawings.placeables.filter((d) => d.data.text.includes("Path")).forEach((path)=> {
            let pathPoints = this.polygonToGlobal(path);
            for(let currPointIndex = 0; currPointIndex < pathPoints.length-1; currPointIndex+=2)
            {
                this.pathCoords.push({"patrolPath": path.id, "x":pathPoints[currPointIndex], "y" : pathPoints[currPointIndex+1]});
            }
        });
        
    }

    polygonToGlobal(drawing) 
    {
        //console.log("Converting polygon points to Global Co-ords...");
        let globalCoords = [];
        if (drawing.data.points.length != 0) 
        {
        drawing.data.points.forEach((point) => {
            globalCoords.push(point[0] + (drawing.x-50), point[1] + (drawing.y-50));
        });
        } 
        else 
        {
        globalCoords = [
            drawing.x,
            drawing.y,
            drawing.x + drawing.width,
            drawing.y,
            drawing.x + drawing.width,
            drawing.y + drawing.height,
            drawing.x,
            drawing.y + drawing.height,
        ];
        }
        return globalCoords;
    }
    
}