(function()	{
	'require strict';

	var app = angular.module('adminApp', ['firebase']);

	app.controller('adminCtrl', ['$scope', '$firebase', '$window', '$interval', '$timeout', function($scope, $firebase, $window, $interval, $timeout)	{
		// Private variables
		var BASE_URL = 'https://turtlerabbit.firebaseio.com/',
			LOBBIES_LOCATION = 'lobbies',
			PLAYER_LOCATION = 'players',
			MAX_PLAYERS_PER_GAME = 1, // CHANGE THIS TO ACTUAL VALUE WHEN DONE TESTING
			TIME_BETWEEN_FIGHTS = 5000, // CHANGE THIS TO 15000 WHEN DONE TESTING
			NUMBER_OF_PERIODS = 2;	// CHANGE THIS TO 20 WHEN DONE TESTING

		// Reference variables
		var baseRef = new Firebase(BASE_URL),
			connectedRef = new Firebase(BASE_URL + '/.info/connected'),
			lobbiesRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION);


		// Authorize this app anonymously
		var auth = new FirebaseSimpleLogin(baseRef, function(error, user) {
						if (error) {
							// an error occurred while attempting login
							console.log(error);
						} else if (user) {
							// user authenticated with Firebase
						} else {
							// user is logged out
						}
					});

		// Authorize with Firebase
		auth.login('anonymous'); 

		// Set initial $scope variables
		$scope.lobbies = $firebase(lobbiesRef);	
		$scope.launchButtonText = 'Launch Game';

		// Function used to launch the game
		$scope.launchGame = function(key)	{
			// CHange text in launch game button to indicate game starting
			$scope.launchButtonText = 'Game starting...';

			// Store references
			var thisLobby = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + key),
				startRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + key + '/startGame');

			// Set ready field in start game flag then change button text back
			startRef.set({ready: true}, function() {
				$scope.launchButtonText = 'Launch game';
			});
		}

		// Function used to purge the game in case auto-purging does not work
		$scope.purgeGame = function(key)	{
			var lob = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + key);

			lob.remove();
		}

		$scope.exportAll = function(){
			var lobbies = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION);

			var csvContent = "data:text/csv;charset=utf-8,";
			csvContent+="lobby,turtle_name,rabbit_name,round,cherry1,cherry2,cherry3,cherry4,carrot1,carrot2,carrot3,carrot4,turtle_score,rabbit_score,turtle_selection,rabbit_selection\n"
			
			lobbies.once('value', function (snap) {
				snap.forEach(function(lobby){
					var turtle, rabbit;
					lobby.child('players').forEach(function(data){
						if(data.child('character').val()=='turtle'){
							turtle = data.child('name').val();
						}else{
							rabbit = data.child('name').val();

						}
					});
					lobby.child('history').forEach(function(data){
						csvContent+= lobby.name()+",";
						csvContent+= turtle+",";
						csvContent+= rabbit+",";
						csvContent+= data.child('round').val()+","
						csvContent+= data.child('cherry').val()+","					
						csvContent+= data.child('carrot').val()+","
						csvContent+= data.child('turtle_score').val()+","
						csvContent+= data.child('rabbit_score').val()+","
						csvContent+= data.child('turtle_selection').val()+","
						csvContent+= data.child('rabbit_selection').val()+"\n"
					});
				});
			});

			filename = "lobbies";

			var encodedUri = encodeURI(csvContent);
			var link = document.createElement("a");
			document.body.appendChild(link);

			link.setAttribute("href", encodedUri);
			link.setAttribute('target', '_blank');
			link.setAttribute("download", filename+".csv");
			link.click();
		}


		$scope.export = function(key){
			var lobby = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + key);

			var csvContent = "data:text/csv;charset=utf-8,";
			csvContent+="round,cherry1,cherry2,cherry3,cherry4,carrot1,carrot2,carrot3,carrot4,turtle_score,rabbit_score,turtle_selection,rabbit_selection\n"
			lobby.once('value', function (snapshot) {
				snapshot.child('history').forEach(function(data){
					csvContent+=data.child('round').val()+","
					csvContent+=data.child('cherry').val()+","					
					csvContent+=data.child('carrot').val()+","
					csvContent+=data.child('turtle_score').val()+","
					csvContent+=data.child('rabbit_score').val()+","
					csvContent+=data.child('turtle_selection').val()+","
					csvContent+=data.child('rabbit_selection').val()+"\n"
				});
			});
			filename = "lobby_"+key;
			lobby.once('value', function (snapshot) {
				snapshot.child('players').forEach(function(data){
					filename+='_'+data.child('name').val();
				});
			});


			var encodedUri = encodeURI(csvContent);
			var link = document.createElement("a");
			document.body.appendChild(link);

			link.setAttribute("href", encodedUri);
			link.setAttribute("download", filename+".csv");
			link.click();
		}


		// Function used to purge a disconnected player from a lobby
		$scope.purgePlayer = function(key, id) {
			var plyr = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + key + '/players/' + id);

			plyr.remove();
		}

		// Every time a value in any of our lobbies change, drill down through the children to see if a player has
		// "readied up". If they have, increment the ready counter and test to see if every player is ready. If all
		// players are ready, activate the "Launch Game" button
		lobbiesRef.on('value', function (snapshot) {
			var rdyCount = {},
				i = 0;

			$scope.allReady = {};

			snapshot.forEach(function (snap) {	
				i = snap.name();	
				rdyCount[i] = 0;

				snap.forEach(function (data) {
					data.forEach(function (subData) {
						if (subData.hasChild('ready')) {							
							rdyCount[i] += 1;
							if (rdyCount[i] === MAX_PLAYERS_PER_GAME)	{
								$scope.allReady[i] = true;
							}
						}
					});
				});
			});
		});

		// Watches lobbies to check if there are no more players in a game and if there are not, will auto-purge that game lobby
		lobbiesRef.on('value', function (snapshot) {
			var name;

			snapshot.forEach(function (snap) {
				var count = snap.numChildren(),
					i = 0;

				name = snap.name();

				if (!snap.val().players)	{
					var lob = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + name);

					lob.remove();
				}				
			});
		});

		// Watch the experimenter's connected status 
		connectedRef.on("value", function (isOnline) {
			if (isOnline.val()) {
				console.log('Online');
			} 
			else {
				console.log('Offline');
			}
		});
	}]);
})();