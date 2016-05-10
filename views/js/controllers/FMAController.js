app.controller('FMAController', ['$scope','$http', 'baseUrl', "$sce", function($scope,$http,baseUrl,$sce) {
	
	$scope.editName = false;
	$scope.showPanel = false;
	$scope.showAddError = false;
	$scope.messageAddError = "";
	
	$scope.selected = false;
	$scope.server = "";
	$scope.championData={};
	$scope.championImageData={};
	
	var socket;
	
	$scope.summoners = {};
	$scope.lockedPositions = {};
	$scope.lockedChampions = {};
	$scope.bannedChampions;
	$scope.chestOptimized;
	
	$scope.composition = {};
	
	$scope.modal = {open:false};
	
	if(typeof window.location.pathname.split("/")[2] == "undefined")
		socket = io.connect(baseUrl);
	else
		socket = io.connect(baseUrl,{query:"room="+window.location.pathname.split("/")[2]});
	
	socket.on('message', function(message) {
		console.log(message)
		switch(message.header){
			
			/* Update list of users */
			case "usersList":
				$scope.usersList = message.content;
				break;
			
			
			/* Update list of summoners */
			case "summonersList":
				$scope.summoners = message.content;
				$scope.showPanel = Object.keys($scope.summoners).length>0;
				break;
			
			
			/* Update username */
			case "userName":
				$scope.userName = message.content;
				break;
			
			
			/* Update ban list */
			case "bannedChampions":
				$scope.bannedChampions = message.content;
				break;
				
				
			/* Update summoner's positions banned */
			case "bannedPosition":
				$scope.summoners[message.content.summoner].bannedPositions = message.content.position;
				break;
				
				
			/* Update chest optimization */
			case "chestOptimized":
				$scope.chestOptimized = message.content;
				break;
				
				
			/* Update server */
			case "changeServer":
				$scope.server = message.content;
				break;
				
				
				
			/* Update data from room */
			case "enterRoom":
				
				/* Update champion data */
				$scope.championImageData = message.content.championImageData;
				$scope.championData = message.content.championData;
				
				/* Update username */
				$scope.userName = message.content.userName;
				
				/* Update list of users */
				$scope.usersList = message.content.usersList;
				
				/* Update list of summoners */
				$scope.summoners = message.content.summoners;
				
				/* Update list of summoners */
				$scope.bannedChampions = message.content.bannedChampions;
				
				/* Update list of summoners */
				$scope.composition = message.content.suggestedPositions;
				
				/* Update list of locked positions */
				$scope.lockedPositions = message.content.lockedPositions;
				
				/* Update list of locked champions */
				$scope.lockedChampions = message.content.lockedChampions;
				
				/* Update chest optimization */
				$scope.chestOptimized = message.content.chestOptimized;
				
				/* Update chest optimization */
				$scope.server = message.content.server;
				
				
				/* Update room URL */
				window.history.pushState("FullMastery Alchemist", "FullMastery Alchemist", baseUrl+"r/"+message.content.room);
				
				$scope.showPanel = Object.keys($scope.summoners).length>0;
				
				break;
				
				
				
			/* Adding a summoner */
			case "summonerData":
				
				if(message.content.result=="success"){
					
					$scope.summoners[message.content.data.summoner.id] = message.content.data;
					$scope.bannedChampions[message.content.data.summoner.id]={};
					
					$scope.showPanel = Object.keys($scope.summoners).length>0;
					
				}else{
					
					if(message.content.data=="Max length reached"){
						$scope.showAddError = true;
						$scope.messageAddError = "Can't add more summoner";
					}
					else if(message.content.data=="Not found"){
						$scope.showAddError = true;
						$scope.messageAddError = "Summoner not found";
					}
					else{
						$scope.showAddError = true;
						$scope.messageAddError = "A strange error happened";
					}
					
				}
				
				break;
			
			
			/* Updating suggestion */
			case "composition":
				
				if(message.content.result == "success")
					$scope.composition = message.content.data;
				
				break;
			
			
			/* Updating locked positions */
			case "updateLockedPositions":
				
				$scope.lockedPositions = message.content;
				
				break;
			
			
			/* If the lock position failed */
			case "failLockPosition":
				
				delete $scope.lockedPositions[message.content.position];
				
				break;
				
			/* Updating locked champions */
			case "updateLockedChampions":
				
				$scope.lockedChampions = message.content;
				
				break;
			
			
			/* If the lock champion failed */
			case "failLockChampion":
				
				delete $scope.lockedChampions[message.content.champion];
				
				break;
				
			
			/* On receiveing message */
			case "getMessage":
				
				$("#chatRoom").append("<p>"+message.content.user+" : "+message.content.content+"</p>");
				$('#chatRoom').animate({scrollTop: $('#chatRoom').prop('scrollHeight')});
				
				break;
			
		}
		$scope.$apply();
	});
	
	
	$scope.sendEditName = function(event){
		
		if(event.keyCode == 13){
			
			socket.emit('message', {header:"changeUserName",content:$scope.userName});
			
			$scope.editName=false;
			
		}
		
	};
	
	$scope.addSummoner = function(event){
		
		if(!event || event.keyCode == 13){
		
			$scope.showAddError = false;
			$scope.messageAddError = "";
			
			socket.emit('message', {header:"addSummoner",content:$scope.addSummonerName});
			
			$scope.addSummonerName="";
			
			$scope.showPanel = Object.keys($scope.summoners).length>0;
			
		}
		
	}
	
	$scope.deleteSummoner = function(id){
		
		$scope.selected = true;
		
		delete $scope.summoners[id];
		
		delete $scope.bannedChampions[id];
		
		$scope.showPanel = Object.keys($scope.summoners).length>0;
		
		socket.emit('message', {header:"deleteSummoner",content:id});
		
	}
	
	/* Check if champion is ban */
	$scope.isBannedChampion = function(summoner, champion, position){
		
	
		if( 
			(typeof $scope.bannedChampions[summoner][champion] != "undefined" && typeof $scope.bannedChampions[summoner][champion].global != "undefined") 	/* If champion is ban for this summoner AND for no specific position */
			// || typeof $scope.bannedChampions["global"][champion] != "undefined" 																			/* If champion is ban for every summoner */
		)
			return true;
		
		
		if(position)
			if(typeof $scope.bannedChampions[summoner][champion] != "undefined" && typeof $scope.bannedChampions[summoner][champion][position] != "undefined") /* If champion is ban for this summoner AND this specific position */
				return true;
		
		
		return false;
		
	}
	
	/* Ban or unban champion */
	$scope.toggleChampion = function(summoner, champion, position){
		
		
		console.log($scope.bannedChampions);
		/* Ban whatever the position */
		if(!position) position = "global";
		
		/* If the champion is not ban, add it to ban list */
		if(!$scope.isBannedChampion(summoner, champion, position)){
		
			if(typeof $scope.bannedChampions[summoner][champion] =="undefined")
				$scope.bannedChampions[summoner][champion] = {};
				
			$scope.bannedChampions[summoner][champion][position]=true;
			
			socket.emit('message', {header:"addBanChampion",content:{summoner:summoner,champion:champion,position:position}});
			
		}
		/* If the champion is already ban, delete it from ban list */
		else{
			
			delete $scope.bannedChampions[summoner][champion][position];
			
			if(Object.keys($scope.bannedChampions[summoner][champion]).length == 0)
				delete $scope.bannedChampions[summoner][champion];
			
			socket.emit('message', {header:"deleteBanChampion",content:{summoner:summoner,champion:champion,position:position}});
			
		}
		
	};
	
	
	/* Check if position is ban */
	$scope.isBannedPosition = function(summoner, position){
		
		return (typeof $scope.summoners[summoner].bannedPositions[position]) != "undefined";
		
	}
	
	/* Ban or unban a position */
	$scope.togglePosition = function(summoner, position){
		
		/* If the poistion is not ban, add it to ban list */
		if(!$scope.isBannedPosition(summoner, position)){
			
			$scope.summoners[summoner].bannedPositions[position]=true;
			
			socket.emit('message', {header:"addBanPosition",content:{summoner:summoner,position:position}});
			
		}
		
		/* If the position is already ban, delete it from ban list */
		else {
			
			delete $scope.summoners[summoner].bannedPositions[position];
			
			socket.emit('message', {header:"deleteBanPosition",content:{summoner:summoner,position:position}});
			
		}
	}
	
	
	function hasLockedPosition(lockedPosition,summoner){
		
		for(var i in lockedPosition){
			if(lockedPosition[i] == summoner)
				return true;
		}
		return false;
	}
	
	
	$scope.toggleChestOptimization = function(){
		
		$scope.chestOptimized = !$scope.chestOptimized;
		
		socket.emit('message', {header:"changeChestOptimization",content:$scope.chestOptimized});
		
	}
	
	$scope.openModalPosition = function($event,summoner){
		
		$scope.modal={};
		
		$scope.modal.open = true;
		$scope.modal.summoner = summoner;
		
		$scope.modal.left = $event.clientX;
		$scope.modal.top = $event.clientY;
		
		$scope.modal.title = "Lock position";
		
		$scope.modal.type="position";
		
	}
	
	$scope.lockPosition = function(summoner, position){
		
		$scope.modal.open = false;
		$scope.modal.type = false;
		
		$scope.lockedPositions[position] = summoner;
		
		socket.emit('message', {header:"lockPosition",content:{summoner:summoner,position:position}});
		
	}
	
	$scope.unlockPosition = function(position){
		
		delete $scope.lockedPositions[position];
		
		socket.emit('message', {header:"unlockPosition",content:{position:position}});
		
	}
	
	$scope.isLockedPosition = function(position){
		
		if(!$scope.lockedPositions[position])
			return false;
			
		return true;
		
	}
	
	$scope.openModalChampion = function($event,summoner, champion){
		
		$scope.modal={};
		
		$scope.modal.open = true;
		$scope.modal.summoner = summoner;
		
		$scope.modal.left = $event.clientX;
		$scope.modal.top = $event.clientY;
		
		$scope.modal.title = "Lock champion";
		
		$scope.modal.type="champions";
		
		$scope.unlockChampion(champion);
	}
	
	$scope.lockChampion = function(summoner, champion){
		
		$scope.modal.open = false;
		$scope.modal.type = false;
		
		$scope.lockedChampions[champion] = summoner;
		
		socket.emit('message', {header:"lockChampion",content:{summoner:summoner,champion:champion}});
		
	}
	
	$scope.unlockChampion = function(champion){
		
		delete $scope.lockedChampions[champion];
		
		socket.emit('message', {header:"unlockChampion",content:{champion:champion}});
		
	}
	
	$scope.isLockedChampion = function(champion){
		
		if(!$scope.lockedChampions[champion])
			return false;
			
		return true;
		
	}
	
	$scope.openModalBan = function($event){
		
		$scope.modal={};
		
		$scope.modal.open = true;
		
		$scope.modal.left = $event.clientX - window.innerWidth*0.6;
		$scope.modal.top = $event.clientY;
		
		$scope.modal.title = "Ban champions";
		
		$scope.modal.type="ban";
	}
	
	
	$scope.sendMessage = function(event){
		
		if(event.keyCode == 13){
			
			socket.emit('message', {header:"sendMessage",content:$scope.message});
			
			$scope.message="";
			
		}
		
	};
	
	$scope.updateServer = function(server){
		
		socket.emit('message', {header:"changeServer",content:server});
		
	}
	
	
}]);