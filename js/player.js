

// Controller for Game 
app.controller('PlayerCtrl', ['$scope', '$location', '$firebase', function($scope, $location, $firebase) {
	var lobbyRef = myUserRef.parent();
	var boardRef = lobbyRef.parent().child('board');
	// Get and store references from our service

	// Retrieve player object from local storage

	$scope.select =  function(key) {
		//if($scope.player.$child('status') == "ready4select"){admin
			$scope.player.$child('selection').$set(key);
			$scope.player.$child('status').$set("selected");
		//}
		//if others made decision,
		//update score

		//The file game.js sends lobbyRef
		var allSelected = true;
		lobbyRef.once('value', function(lobby)  {
			lobby.forEach(function(player)  {
				if(player.val().status != "selected"){
					allSelected = false;
				}
			});
		});
		
		if(allSelected){
			lobbyRef.once('value', function(lobby)  {
				lobby.forEach(function(player)  {
					player.ref().update({status: "viewresult"});
				});
			});
			showResult();
			saveData();
		}
		
	}

	$scope.getBorder = function(p1, p2){
		if($scope.player.status == "viewresult" || $scope.player.status == "reday4next"){
			if(($scope.player.character == "turtle" && $scope.player.selection == p1 && $scope.opponent.selection == p2)||($scope.player.character == "rabbit" && $scope.player.selection == p2 && $scope.opponent.selection == p1)){
					return {'border' : 'thick solid maroon'};
			}
		}
	}

	$scope.setButtonColor = function(p1, p2){
		if($scope.player.character == p1 && $scope.player.selection == p2){
			return {'backgroundColor':'yellow'};
		}else if($scope.opponent.character == p1 && $scope.opponent.selection == p2){
			return {'backgroundColor':'yellow'};
		}
	}

	function showResult(){
		var coord = [-1, -1];
		var point = [0, 0];
		lobbyRef.once('value', function(lobby)  {
			lobby.forEach(function(player)  {
				coord[player.val().player_number - 1] = player.val().selection;
				point[player.val().player_number - 1] = player.val().score;
			});
		});

		index = coord[0] * 2 + coord[1];
		boardRef.child('cherry').once('value', function(data) {
			point[0] += data.val()[index];		
		});

		boardRef.child('carrot').once('value', function(data) {
			point[1] += data.val()[index];				
		});

		lobbyRef.once('value', function(lobby)  {
			lobby.forEach(function(player)  {
				player.ref().update({score: point[player.val().player_number - 1]});
			});
		});
	}

	function saveData(){
		var history = {};
		boardRef.child('round').once('value', function(data) {
			 history.round = data.val();		
		});
		boardRef.child('cherry').once('value', function(data) {
			history.cherry = data.val();		
		});
		boardRef.child('carrot').once('value', function(data) {
			history.carrot = data.val();		
		});
		if($scope.player.character=='turtle'){
			history.turtle_selection = $scope.player.selection;
			history.turtle_score = $scope.player.score;
			history.rabbit_selection = $scope.opponent.selection;
			history.rabbit_score = $scope.opponent.score;
		}else{
			history.rabbit_selection = $scope.player.selection;
			history.rabbit_score = $scope.player.score;
			history.turtle_selection = $scope.opponent.selection;
			history.turtle_score = $scope.opponent.score;
		}
		var name = 'round'+history.round;
		console.log(name);
		var roundRef = lobbyRef.parent().child('history').child(name);
		roundRef.set(history);
	}


	$scope.next = function(){
		//check if opponents started,
		//if not just set ready
		//if($scope.player.$child('status') == "viewresult"){
			$scope.player.$child('status').$set("ready4next");
		//}

		nextRound = true;
		lobbyRef.once('value', function(lobby)  {
			lobby.forEach(function(player)  {
				if(player.val().status != "ready4next"){
					nextRound = false;
				}
			});
		});			

		//init the board and start the game
		if(nextRound == true){
			lobbyRef.once('value', function(lobby)  {
				lobby.forEach(function(player)  {
					player.ref().update({status: "ready4select"});
				});

			});
			initBoard();
		}
	}

	function initBoard(){
		board1 = [-1,-1,-1,-1]
  		var i = 0
  		for(i=0; i<4; i++){
    		while(true){
      			r = Math.floor((Math.random()*4)+1);
      			if(board1.indexOf(r)<0){
        			board1[i] = r;
        			break;
      			}
    		}
  		}
  		board2 = [-1,-1,-1,-1]
  		for(i=0; i<4; i++){
    		while(true){
      			r = Math.floor((Math.random()*4)+1);
      			if(board2.indexOf(r)<0){
        			board2[i] = r;
        			break;
      			}
    		}
  		}

  		rnd = 0;
		boardRef.child('round').once('value', function(data) {
			 rnd = data.val();		
		});

  		boardRef.set({cherry:board1,carrot:board2,round:rnd+1});

		boardRef.child('cherry').once('value', function(data) {
			$scope.imgstrcherry1 = "https://dl.dropboxusercontent.com/u/4745232/carrots/cherry"+data.val()[0]+".png"		
		});
  	}


	// If the player wasn't previously in a game, initialize them
	initializeGame();	

	// Initializes player values when coming into game view, myUserRef comes from game.js
	function initializeGame()	{
		// Set Firebase user reference to scope variable
		$scope.player = $firebase(myUserRef);
		// Set Firebase Lobby reference to scope variable
		$scope.lobby = $firebase(lobbyRef);
		$scope.base = $firebase(lobbyRef.parent());
		//lobbyRef.parent().update({'history':{}}); (update wouldn't work for this)
		if($scope.player.character == 'turtle'){
			lobbyRef.parent().update({board:{cherry:[-1,-1,-1,-1],carrot:[-1,-1,-1,-1],round:0}}); 
			initBoard();   		
		}

		var opponent;

		lobbyRef.once('value', function(lobby)  {
			lobby.forEach(function(player)  {
				if(player.val().character != $scope.player.character)
				opponent = player.ref();
			});
		});
		$scope.opponent = $firebase(opponent);

	}		
	
}]);