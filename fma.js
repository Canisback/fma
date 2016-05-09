var API_KEY = 'ceb9f3a7-f693-44bb-ada1-b09fbfc9fb98';

var fs = require('fs');

var LolApi = require('leagueapi');
LolApi.init(API_KEY, 'euw');

var http = require('http')
  , https = require('https');

var server = http.createServer(function(req, res){

	fs.readFile('views/fma.html', 'utf-8', function(error, content) {
		res.writeHead(200, {"Content-Type": "text/html"});
		res.end(content);
	});

});
var idUser=0;


var roomId;
var roomData = {};

var cache={};

var championData;
var championImageData={data:{}};

fs.readFile('./listChampions', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
 championData = JSON.parse(data);
});
updateChampionImageData();


var gradeValues={
	"S+":14,
	"S":13,
	"S-":12,
	"A+":11,
	"A":10,
	"A-":9,
	"B+":8,
	"B":7,
	"B-":6,
	"C+":5,
	"C":4,
	"C-":3,
	"D+":2,
	"D":1,
	"D-":0.5
};




var io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {
	
	idUser++;
	
	socket.idUser = "user_"+idUser;
	
	
	/* Routing on socket connect */
	if(typeof socket.handshake.query.room == "undefined"){
		var code = createCode();
		while(typeof roomData[code] != "undefined")code = createCode();
		socket.room=code;
		
		
		roomData[code]={
			server:"euw",
			clients:[],
			summoners:{},
			lockedPositions:{},
			lockedChampions:{},
			bannedChampions:{"global":{}},
			chestOptimized:true
		};
		
		
	}else{
	
		if(typeof roomData[socket.handshake.query.room] == "undefined"){
			
			roomData[socket.handshake.query.room]={
				server:"euw",
				clients:[],
				summoners:{},
				suggestedPositions:{},
				lockedPositions:{},
				lockedChampions:{},
				bannedChampions:{"global":{}},
				chestOptimized:true
			};
			
		}
		
		socket.room=socket.handshake.query.room;
		
	}
	/* End routing */
	
	
	
	socket.join(socket.room);
	socket.userName = socket.idUser;
	roomData[socket.room].clients.push(socket.idUser);
	
	
	socket.broadcast.to(socket.room).emit('message', {header : "usersList", content : roomData[socket.room].clients});
	
	socket.emit('message', {header : "enterRoom", content :{
			championImageData:championImageData,
			championData:championData,
			summoners : roomData[socket.room].summoners,
			suggestedPositions : roomData[socket.room].suggestedPositions,
			lockedPositions : roomData[socket.room].lockedPositions,
			lockedChampions : roomData[socket.room].lockedChampions,
			usersList : roomData[socket.room].clients,
			bannedChampions : roomData[socket.room].bannedChampions,
			userName : socket.idUser,
			room : socket.room,
			chestOptimized : roomData[socket.room].chestOptimized,
		}});
	
	
	socket.on("message", function(message){
	
		switch(message.header){
			
			case "changeUserName":
				
				/* Deleting old username from clients list */
				var index = roomData[socket.room].clients.indexOf(socket.userName);
				if (index > -1) {
					roomData[socket.room].clients.splice(index, 1);
				}
				
				/* Updating username in socket */
				socket.userName = message.content;
				
				/* Updating username in roomData */
				roomData[socket.room].clients.push(socket.userName);
				
				/* Sending updated data to everyone in the room */
				socket.broadcast.to(socket.room).emit('message', {header : "usersList", content : roomData[socket.room].clients});
				socket.emit('message', {header : "usersList", content : roomData[socket.room].clients});
				socket.emit('message', {header : "userName", content : socket.userName});
				
				break;
				
			case "addSummoner":
				
				/* No more than 5 summoners */
				if(Object.keys(roomData[socket.room].summoners).length < 5){
					getSummonerInfo(socket, message.content.toLowerCase().replace(/\s+/g, ''), roomData[socket.room].server);

					
					setTimeout(function () {
					  suggestComposition(socket);
					}, 1000)
				}
				
				else
					socket.emit('message', {header : "summonerData", content : {result:"error",data:"Max length reached"}});
				
				
				break;
				
				
			case "deleteSummoner":
				
				/* Delete targeted summoner from the summoners list */
				delete roomData[socket.room].summoners[message.content];
				
				/* Delete targeted summoner from the ban list */
				delete roomData[socket.room].bannedChampions[message.content];
				
				/* Delete targeted summoner from locked positions */
				for(var i in roomData[socket.room].lockedPositions)
					if(roomData[socket.room].lockedPositions[i]==message.content)
						delete roomData[socket.room].lockedPositions[i];
						
				/* Delete targeted summoner from locked champions */
				for(var i in roomData[socket.room].lockedChampions)
					if(roomData[socket.room].lockedChampions[i]==message.content)
						delete roomData[socket.room].lockedChampions[i];
				
				socket.broadcast.to(socket.room).emit('message', {header : "summonersList", content : roomData[socket.room].summoners});
				
				suggestComposition(socket);
				
				break;
				
				
			case "addBanChampion":
				
				/* Create object if needed */
				if(typeof roomData[socket.room].bannedChampions[message.content.summoner][message.content.champion] =="undefined")
					roomData[socket.room].bannedChampions[message.content.summoner][message.content.champion] = {};
				
				/* Add champion/position to the ban list */
				roomData[socket.room].bannedChampions[message.content.summoner][message.content.champion][message.content.position]=true;
				
				socket.broadcast.to(socket.room).emit('message', {header : "bannedChampions", content : roomData[socket.room].bannedChampions});
				
				suggestComposition(socket);
				
				break;
				
				
			case "deleteBanChampion":
				
				/* Delete champion/position from the ban list */
				delete roomData[socket.room].bannedChampions[message.content.summoner][message.content.champion][message.content.position];
				
				
				if(Object.keys(roomData[socket.room].bannedChampions[message.content.summoner][message.content.champion]).length == 0)
					delete roomData[socket.room].bannedChampions[message.content.summoner][message.content.champion];
				
				socket.broadcast.to(socket.room).emit('message', {header : "bannedChampions", content : roomData[socket.room].bannedChampions});
				
				suggestComposition(socket);
				
				break;
				
			case "addBanPosition":
			
				/* Add position to the ban list */
				roomData[socket.room].summoners[message.content.summoner].bannedPositions[message.content.position]=true;
				
				socket.broadcast.to(socket.room).emit('message', {header : "bannedPosition", content : {summoner:message.content.summoner,position:roomData[socket.room].summoners[message.content.summoner].bannedPositions}});
				
				suggestComposition(socket);
				
				break;
				
			case "deleteBanPosition":
			
				/* Delete position from the ban list */
				delete roomData[socket.room].summoners[message.content.summoner].bannedPositions[message.content.position];
				
				socket.broadcast.to(socket.room).emit('message', {header : "bannedPosition", content : {summoner:message.content.summoner,position:roomData[socket.room].summoners[message.content.summoner].bannedPositions}});
				
				suggestComposition(socket);
				
				break;
				
				
			case "changeChestOptimization":
				
				roomData[socket.room].chestOptimized = message.content;
				
				socket.broadcast.to(socket.room).emit('message', {header : "chestOptimized", content : roomData[socket.room].chestOptimized});
				
				suggestComposition(socket);
				
				break;
				
			case "lockPosition":
				
				if(!roomData[socket.room].lockedPositions[message.content.position]){
					
					roomData[socket.room].lockedPositions[message.content.position] = message.content.summoner;
					
					socket.broadcast.to(socket.room).emit('message', {header : "updateLockedPositions", content : roomData[socket.room].lockedPositions});
					
					suggestComposition(socket);
					
				}else{
					
					socket.emit('message', {header : "failLockPosition", content : message.content});
					
				}
				
				break;
				
			case "unlockPosition":
				
					
				delete roomData[socket.room].lockedPositions[message.content.position];
				
				socket.broadcast.to(socket.room).emit('message', {header : "updateLockedPositions", content : roomData[socket.room].lockedPositions});
				
				suggestComposition(socket);
				
				break;
				
			case "lockChampion":
				
				if(!roomData[socket.room].lockedChampions[message.content.champion]){
					
					roomData[socket.room].lockedChampions[message.content.champion] = message.content.summoner;
					
					socket.broadcast.to(socket.room).emit('message', {header : "updateLockedChampions", content : roomData[socket.room].lockedChampions});
					
					suggestComposition(socket);
					
				}else{
					
					socket.emit('message', {header : "failLockChampion", content : message.content});
					
				}
				
				break;
				
			case "unlockChampion":
				
				delete roomData[socket.room].lockedChampions[message.content.champion];
				
				socket.broadcast.to(socket.room).emit('message', {header : "updateLockedChampions", content : roomData[socket.room].lockedChampions});
				
				suggestComposition(socket);
				
				break;
				
			
			/* Chat function */
			case "sendMessage":
				
				var date = new Date();
				var send = {
					header : "message_received", 
					content: message.content, 
					user : socket.userName,
					timestamp : date.getTime()
				};
				
				socket.broadcast.to(socket.room).emit('message', {header:"getMessage",content:send});
				socket.emit('message', {header:"getMessage",content:send});
				
				break;
			
		}
	});
	
	
	socket.on('disconnect', function() {
		
		var index = roomData[socket.room].clients.indexOf(socket.userName);
		if (index > -1) {
			roomData[socket.room].clients.splice(index, 1);
		}
		
		socket.broadcast.to(socket.room).emit('message', {header : "usersList", content : roomData[socket.room].clients});
		
   });
	
});

/* Create a random 8-characters code */
function createCode(){
    var str = "";
    var char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 8; i++ )
        str += char.charAt(Math.floor(Math.random() * char.length));

    return str;
}

function getSummonerInfo(socket, name, server_id){
	
	
	var date = new Date();
	
	/* If summoner has never been searched */
	if(typeof cache[name] == "undefined"){
		
		
		/* Search summoner by name */
		LolApi.Summoner.getByName(name, function(err, summoner) {
			if(!err) {
				
				/* Get the summoner from API data */
				for(var i in summoner)summoner=summoner[i];
				
				
				/* Caching summoner data */
				cache[name] = {
					summoner_timestamp:date.getTime(),
					champion_timestamp:0,
					data:{summoner:summoner}
				}
				
				
				/* Search champion mastery by summoner ID */
				LolApi.getChampionMastery(summoner.id,server_id, function(err, champion_mastery) {
					
					if(!err) {
					
						/* Caching champion mastery data */
						cache[name].champion_timestamp = date.getTime();
						cache[name].data.champion = champion_mastery;
						
						/* Sending data to client */
						sendSummonerInfo(socket,{
							result:"success",
							data:{
								summoner:summoner,
								champion:champion_mastery,
								bannedPositions:{}
							}
						});
						
						/* Storing data in roomData */
						roomData[socket.room].summoners[summoner.id] = {
								summoner:summoner,
								champion:champion_mastery,
								bannedPositions:{}
							};
							
						/* Initializing ban list for summoner */
						roomData[socket.room].bannedChampions[summoner.id]={};
						
						/* Initializing position ban list for summoner */
						roomData[socket.room].summoners[summoner.id].bannedPositions={};
				
							
					}else{
						
						/* Sending error to client */
						sendSummonerInfo(socket,{result:"error",data:"Unknown"});
						
					}
				});
				
			}else{
				
				/* Sending error to client */
				if(err.message=="Error getting summoner data using name: 404 Not Found"){
					
					sendSummonerInfo(socket,{result:"error",data:"Not found"});
					
				}else{
					
					sendSummonerInfo(socket,{result:"error",data:"Unknown"});
					
				}
				
			}
			
		});
			
	}
	
	/* If summoner exists in cache */
	else{
	
		/* If summoner data in cache is outdated */
		if(date.getTime() - cache[name].summoner_timestamp>3600000){
			
			/* Search summoner by name */
			LolApi.Summoner.getByName(name, function(err, summoner) {
				if(!err) {
					
					/* Get the summoner from API data */
					for(var i in summoner)summoner=summoner[i];
					
					
					/* Caching summoner data */
					cache[name] = {
						summoner_timestamp:date.getTime(),
						champion_timestamp:0,
						data:{summoner:summoner}
					}
					
					
					/* Search champion mastery by summoner ID */
					LolApi.getChampionMastery(summoner.id,server_id, function(err, champion_mastery) {
						
						if(!err) {
						
							/* Caching champion mastery data */
							cache[name].champion_timestamp = date.getTime();
							cache[name].champion = champion_mastery;
							
							/* Sending data to client */
							sendSummonerInfo(socket,{
								result:"success",
								data:{
									summoner:summoner,
									champion:champion_mastery,
									bannedPositions:{}
								}
							});
							
							/* Storing data in roomData */
							roomData[socket.room].summoners[summoner.id] = {
									summoner:summoner,
									champion:champion_mastery,
									bannedPositions:{}
								};
							
							/* Initializing ban list for summoner */
							roomData[socket.room].bannedChampions[summoner.id]={};
									
							/* Initializing position ban list for summoner */
							roomData[socket.room].summoners[summoner.id].bannedPositions={};
							
								
						}else{
							
							/* Sending error to client */
							sendSummonerInfo(socket,{result:"error",data:"Unknown"});
							
						}
					});
					
				}else{
					
					/* Sending error to client */
					if(err.message=="Error getting summoner data using name: 404 Not Found"){
						
						sendSummonerInfo(socket,{result:"error",data:"Not found"});
						
					}else{
						
						sendSummonerInfo(socket,{result:"error",data:"Unknown"});
						
					}
					
				}
				
			});
			
		}
		
		/* If champion mastery data in cache is outdated */
		else if(date.getTime() - cache[name].champion_timestamp>1200000){
		
			var summoner = cache[name].data.summoner;
			
			
			/* Search champion mastery by summoner ID */
			LolApi.getChampionMastery(summoner.id,server_id, function(err, champion_mastery) {
				
				if(!err) {
				
					/* Caching champion mastery data */
					cache[name].champion_timestamp = date.getTime();
					cache[name].data.champion = champion_mastery;
					
					/* Sending data to client */
					sendSummonerInfo(socket,{
						result:"success",
						data:{
							summoner:summoner,
							champion:champion_mastery,
							bannedPositions:{}
						}
					});
					
					/* Storing data in roomData */
					roomData[socket.room].summoners[summoner.id] = {
							summoner:summoner,
							champion:champion_mastery,
							bannedPositions:{}
						};
						
					/* Initializing ban list for summoner */
					roomData[socket.room].bannedChampions[summoner.id]={};
							
					/* Initializing position ban list for summoner */
					roomData[socket.room].summoners[summoner.id].bannedPositions={};
					
				}else{
					
					/* Sending error to client */
					sendSummonerInfo(socket,{result:"error",data:"Unknown"});
					
				}
			});
		}
		
		/* If cache is up-to-date */
		else{
		
			roomData[socket.room].summoners[cache[name].data.summoner.id] = cache[name].data;
			
			/* Initializing ban list for summoner */
			roomData[socket.room].bannedChampions[cache[name].data.summoner.id]={};
			
			/* Initializing position ban list for summoner */
			roomData[socket.room].summoners[cache[name].data.summoner.id].bannedPositions={};
			
			var data = cache[name].data;
			
			data.bannedPositions={};
			
			sendSummonerInfo(socket,{result:"success",data:data});
		
		}
	}
	
}

function sendSummonerInfo(socket, info){
	
	/* Sending summoner data to everyone in the room */
	socket.broadcast.to(socket.room).emit('message', {header:"summonerData",content:info});
	socket.emit('message', {header:"summonerData",content:info});
	
}

/* Get champion image data from static API */
function updateChampionImageData(){
	
	LolApi.Static.getChampionList({champData: 'image'}, function(err, champions){
		if(!err) {
			for(var i in champions.data){
				championImageData.data[champions.data[i].id] = champions.data[i];
			}
			championImageData.version = champions.version;
		}
	});
	
}


function suggestComposition(socket){
	
		var summoners = roomData[socket.room].summoners;
		
		var summonersList = {};
		for(var i in Object.keys(summoners))
			summonersList[Object.keys(summoners)[i]] = true;
		
		var initPosition = {
			top:cloneObject(summonersList),
			jungle:cloneObject(summonersList),
			mid:cloneObject(summonersList),
			support:cloneObject(summonersList),
			bot:cloneObject(summonersList)
		}
		
		var lockedPositions = cloneObject(roomData[socket.room].lockedPositions);
		
		var listLockedPositions = Object.keys(lockedPositions);
		
		var lockedChampions = cloneObject(roomData[socket.room].lockedChampions);
		
		var listLockedChampions = Object.keys(lockedChampions);
		
		var suggestedPositions = {};
		
		/* Clear banned positions */
		for(var i in summoners){
			
			for(var j in summoners[i].bannedPositions){
				
				initPosition[j][i] = false;
				
				
			}
		}
		
		
		/* Clear solo suggest */
		var clear = false;
		
		while(!clear){
			
			clear = true;
			
			var nbSolo;
			var positionSolo;
			
			for(var i in summoners){
				
				/* If the summoner has not already locked his position */
				if(!hasLockedPosition(lockedPositions,i)){
					
					nbSolo = 0;
					positionSolo = "";
					
					/* Check if the summoner has only one position that only him handles */
					for(var j in initPosition){
						if(nbPlayerPosition(initPosition[j]) == 1 && initPosition[j][i]){
							nbSolo++;
							positionSolo = j;
						}
					}
					
					/* If the summoner has only one position that only him handles */
					if(nbSolo==1){
						clear = false;
						/* Lock the summoner to the position */
						lockedPositions[positionSolo] = i;
						listLockedPositions.push(positionSolo);
						
						/* Disable the summoner from others positions */
						for(var j in initPosition){
							if(j!=positionSolo)
								initPosition[j][i] = false;
						}
					}
					
				}
			}
			
		}
		
		
		
		/* List of all champions, all positions */
		var listChampions = [];
		
		for(var i in summoners){
		
			if(!hasLockedChampion(lockedChampions,i)){
				
				for(var j in summoners[i].champion){
				
					/* If the champion is not ban or locked */
					if(!isBannedChampion(roomData[socket.room].bannedChampions,i,summoners[i].champion[j].championId) && !lockedChampions[summoners[i].champion[j].championId]){
						
						
						
						/* Setting champion value */
						var value;
						if(typeof summoners[i].champion[j].highestGrade =="undefined")
							value = summoners[i].champion[j].championPoints;
						else
							value = (summoners[i].champion[j].championPoints) * (gradeValues[summoners[i].champion[j].highestGrade]);
							
							
						/* Checked chest optimization */
						if(!summoners[i].champion[j].chestGranted || !roomData[socket.room].chestOptimized)
						
							for(var k in championData[summoners[i].champion[j].championId].position){
							
								/* If the summoner has a locked position and the current champion position match with this locked position */
								if(hasLockedPosition(lockedPositions,i) && (typeof lockedPositions[championData[summoners[i].champion[j].championId].position[k].toLowerCase()] != "undefined") && lockedPositions[championData[summoners[i].champion[j].championId].position[k].toLowerCase()]==i){
								
									listChampions.push({
										summonerId:i,
										championId:summoners[i].champion[j].championId,
										position:championData[summoners[i].champion[j].championId].position[k].toLowerCase(),
										value:value
									});
									
									
								}else
								
								/* If the position is not ban and the summoner has not a locked position */
								if(!hasLockedPosition(lockedPositions,i) && !isBannedChampion(roomData[socket.room].bannedChampions,i,summoners[i].champion[j].championId,championData[summoners[i].champion[j].championId].position[k].toLowerCase()) && !isBannedPosition(summoners,i,championData[summoners[i].champion[j].championId].position[k].toLowerCase()))
									listChampions.push({
										summonerId:i,
										championId:summoners[i].champion[j].championId,
										position:championData[summoners[i].champion[j].championId].position[k].toLowerCase(),
										value:value
									});
								
							}
					
					}
					
				}
				
			}else{
				
				var chId = lockedChampion(lockedChampions,i);
		
				for(var k in championData[chId].position){
				
					/* If the summoner has a locked position and the current champion position match with this locked position */
					if(hasLockedPosition(lockedPositions,i) && (typeof lockedPositions[championData[chId].position[k].toLowerCase()] != "undefined") && lockedPositions[championData[chId].position[k].toLowerCase()]==i){
					
						listChampions.push({
							summonerId:i,
							championId:chId,
							position:championData[chId].position[k].toLowerCase(),
							value:value
						});
						
						
					}else
					
					/* If the position is not ban and the summoner has not a locked position */
					if(!hasLockedPosition(lockedPositions,i) && !isBannedChampion(roomData[socket.room].bannedChampions,i,chId,championData[chId].position[k].toLowerCase()) && !isBannedPosition(summoners,i,championData[chId].position[k].toLowerCase()))
						listChampions.push({
							summonerId:i,
							championId:chId,
							position:championData[chId].position[k].toLowerCase(),
							value:value
						});
					
				}
				
			}
			
			
			
		}
		
		
		/* Sorting champions by their calculated value */
		listChampions.sort(function(a,b){return (a.value<b.value)?1:-1;});
		
		
		for(var i in listChampions){
			
			if(
				((listLockedPositions.indexOf(listChampions[i].position)==-1 && !hasLockedPosition(lockedPositions,listChampions[i].summonerId) ) 							/* The position is not locked and the summoner has not locked his position */ 
					|| (typeof lockedPositions[listChampions[i].position] !="undefined" && lockedPositions[listChampions[i].position]==listChampions[i].summonerId))		/* The summoner has locked this position */
				&& 
				((listLockedChampions.indexOf(listChampions[i].championId)==-1 && !hasLockedChampion(lockedChampions,listChampions[i].summonerId) ) 						/* The champion is not locked and the summoner has not locked his champion */ 
					|| (typeof lockedChampions[listChampions[i].championId] !="undefined" && lockedChampions[listChampions[i].championId]==listChampions[i].summonerId))	/* The summoner has locked this champion */
				&& !suggestedPositions[listChampions[i].summonerId])																										/* The summoner has not yet his suggested position and champion determined */
				{
				
				suggestedPositions[listChampions[i].summonerId] = {champion:listChampions[i].championId,position:listChampions[i].position}
				listLockedPositions.push(listChampions[i].position);
				listLockedChampions.push(listChampions[i].championId);
				
				
							
					var clear = false;
					
					while(!clear){
						
						clear = true;
						
						var nbSolo;
						var positionSolo;
						
						for(var i in summoners){
							
							/* If the summoner has not already locked his position */
							if(!hasLockedPosition(lockedPositions,i)){
								
								nbSolo = 0;
								positionSolo = "";
								
								/* Check if the summoner has only one position that only him handles */
								for(var j in initPosition){
									if(nbPlayerPosition(initPosition[j]) == 1 && initPosition[j][i]){
										nbSolo++;
										positionSolo = j;
									}
								}
								
								/* If the summoner has only one position that only him handles */
								if(nbSolo==1){
									clear = false;
									/* Lock the summoner to the position */
									lockedPositions[positionSolo] = {summoner:i};
									listLockedPositions.push(positionSolo);
									
									/* Disable the summoner from others positions */
									for(var j in initPosition){
										if(j!=positionSolo)
											initPosition[j][i] = false;
									}
								}
								
							}
						}
						
					}
				
			}
			
		}
		
	roomData[socket.room].suggestedPositions = suggestedPositions;
	
	socket.broadcast.to(socket.room).emit('message', {header : "composition", content : {result:"success",data:suggestedPositions}});
	socket.emit('message', {header : "composition", content : {result:"success",data:suggestedPositions}});
	
}


function cloneObject(obj) {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}
 
	var temp = obj.constructor();
	for (var key in obj) {
		temp[key] = cloneObject(obj[key]);
	}
 
	return temp;
}


/* Returns the number of position allowed for a summoner */
function nbPlayerPosition(position){
	var nb = 0;
	for(var i in position){
		if(position[i])nb++;
	}
	return nb;
}
	
/* Returns if the summoner has a locked position */
function hasLockedPosition(lockedPosition,summoner){
	
	for(var i in lockedPosition){
		if(lockedPosition[i] == summoner)
			return true;
	}
	return false;
}

/* Returns if the summoner has a locked champion */
function hasLockedChampion(lockedChampion,summoner){
	
	for(var i in lockedChampion){
		if(lockedChampion[i] == summoner)
			return true;
	}
	return false;
}


/* Returns locked champion of a summonerId */
function lockedChampion(lockedChampion,summoner){

	for(var i in lockedChampion){
		if(lockedChampion[i] == summoner)
			return i;
	}
	
}

function isBannedPosition(summoners, summoner, position){
	
	return (typeof summoners[summoner].bannedPositions[position]) != "undefined";
	
}


function isBannedChampion(bannedChampions, summoner, champion, position){

	if( 
		(typeof bannedChampions[summoner][champion] != "undefined" && typeof bannedChampions[summoner][champion].global != "undefined") 	/* If champion is ban for this summoner AND for no specific position */
		|| typeof bannedChampions["global"][champion] != "undefined" 																			/* If champion is ban for every summoner */
	)
		return true;
	
	
	if(position)
		if(typeof bannedChampions[summoner][champion] != "undefined" && typeof bannedChampions[summoner][champion][position] != "undefined") /* If champion is ban for this summoner AND this specific position */
			return true;
	
	
	return false;
	
}


server.listen(3000);