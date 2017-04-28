// Local Storage polyfill
if (!window.localStorage) {
	window.localStorage = {
		getItem: function (sKey) {
			if (!sKey || !this.hasOwnProperty(sKey)) { return null; }
			return unescape(document.cookie.replace(new RegExp("(?:^|.*;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*"), "$1"));
		},
		key: function (nKeyId) {
			return unescape(document.cookie.replace(/\s*\=(?:.(?!;))*$/, "").split(/\s*\=(?:[^;](?!;))*[^;]?;\s*/)[nKeyId]);
		},
		setItem: function (sKey, sValue) {
			if(!sKey) { return; }
			document.cookie = escape(sKey) + "=" + escape(sValue) + "; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/";
			this.length = document.cookie.match(/\=/g).length;
		},
		length: 0,
		removeItem: function (sKey) {
			if (!sKey || !this.hasOwnProperty(sKey)) { return; }
			document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
			this.length--;
		},
		hasOwnProperty: function (sKey) {
			return (new RegExp("(?:^|;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
		}
	};

	window.localStorage.length = (document.cookie.match(/\=/g) || window.localStorage).length;
}

// Private variables
var BASE_URL = 'https://turtlerabbit.firebaseio.com/',
	LOBBIES_LOCATION = 'lobbies',
	PLAYER_LOCATION = 'players',
	RECENTS_LOCATION = 'recent_players',
	GAME_LOCATION = 'games',
	MAX_PLAYERS_PER_GAME = 2, // CHANGES THIS TO ACTUAL VALUE WHEN DONE TESTING
	myUserRef,
	ONE_HOUR = 60 * 60 * 1000;

var app = angular.module('gameApp', ['firebase', 'ngRoute']);

app.config(function($routeProvider, $locationProvider) {
	$routeProvider
		.when('/game', {templateUrl: 'game.html', controller: 'PlayerCtrl'})
		.otherwise({redirectTo: '/'});
});	

// This service gets the client's IP address from a 3rd-party service and returns it
app.factory('getIPSvc', ['$http', function ($http) {
	return {
		getIP: function() {
			return Math.floor((Math.random()*100000000000)+1);
		}
	}
	
}]);

// controller for the lobby before entering the game
app.controller('LobbyCtrl', ['$scope', '$interval', '$timeout', '$route', '$http', '$q', '$location', '$firebase', 'getIPSvc', function($scope, $interval, $timeout, $route, $http, $q, $location, $firebase, getIPSvc){				
	// Player variables
	var name,
		myIP,
	  	wasOnline = false,
	  	ready = false,
	  	lobbyNum,
	  	readyInterval,
	  	lobbyCheckCounter = 0,
	  	lobbyRef,
	  	startRef,
	  	boardRef;

	// Reference variables
	var baseRef = new Firebase(BASE_URL),
		connectedRef = new Firebase(BASE_URL + '/.info/connected'),
		recentsRef = new Firebase(BASE_URL + '/' + RECENTS_LOCATION);

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

	// Login to Firebase's auth server so it knows the client is authorized to use it
	auth.login('anonymous');

	// Set initial $scope variables
	$scope.showCountdown = false;
	$scope.readyText = 'Ready';
	$scope.imgstrcherry1 = '';

	// First check our player to see if they are reconnecting
	checkPlayer();
	
	// Check if this player has been in a lobby recently and if so, place them back in that lobby. If not, find them a lobby
	function checkPlayer() {
		// If there is already data in our local storage key, use that to determine when the player was last online
		if (localStorage.getItem('gamePlayer'))	{
			console.log('Player information found')
			// Store the player object
			var playerInfo = JSON.parse(localStorage.getItem('gamePlayer'));

			// Store the saved reference to this player as a new Firebase reference
			var plyrRef = new Firebase(playerInfo.ref);

			// Get the timestamp from when this player was disconnected
			plyrRef.once('value', function (data) {
				// Check to see if their firebase reference contains keys for both a disconnect time and a lobby
				if (data.hasChild('disconnectTime') && data.hasChild('lobby'))	{
					var oldDate = data.val().disconnectTime,
					newDate = new Date().getTime();

					// Compare original creation time to current time. If it has been less than the alotted time, return them to their lobby
					// **NOTE: currently the allowed time for reconnection is set to thirty minutes. We will likely want to reduce this**
					if ((newDate - oldDate) < (ONE_HOUR / 2))	{
						returnPlayer(playerInfo);
					}
					// If it has been longer than the alotted time, find them a new lobby
					else {
						console.log("You've been gone too long from this game. Joining new lobby.");
						$scope.gameStarted = false;
						initLobby();
					}
				}
				// If their Firebase reference does not contain both a disconnect time and a lobby key, find a new lobby
				else {
					console.log('No disconnect time or lobby information found, initializing new player');
					initLobby();
				}		
			});		
		}
		// If there is no local storage reference for this player, find a lobby. One will be created in the process
		else {
			console.log('No player information found locally. Creating new player.');
			initLobby();
		}
	}

	// Grabs the new player's IP address then begins checking lobbies 
	function initLobby() {
		lobbyNum = 0;
		// Get and store this client's IP address (this has a hard reliance on an external service)
		/*getIPSvc.getIP().then(function(result) {
			myIP = result.data.ip;
			console.log(myIP)
		});	*/
		myIP = getIPSvc.getIP();
		// Check available lobbies 
		console.log('One moment while we find you a lobby');
		checkLobby(lobbyNum);
	}

	// This function checks the status of the first lobby to see if it has room for more players.
	// If it does not have room, it increments the lobby counter and checks the next one until
	// it finds a lobby that has room for this player.
	function checkLobby(lobbyNum)	{
		var lobbyCount = 0;

		lobbyRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + lobbyNum + '/' + PLAYER_LOCATION);

		lobbyRef.once('value', function (dataSnapshot) {
			lobbyCount = dataSnapshot.numChildren();
			console.log('Trying to join lobby ' + lobbyNum + '. There are ' + lobbyCount + ' players.');

			if (lobbyCount < MAX_PLAYERS_PER_GAME)	{
				// Protection for simultaneous connections
				if (lobbyCheckCounter > 0)	{
					console.log('Joining lobby ' + lobbyNum);

					// Check one last time to make sure we didn't overload the lobby and if we did,
					// remove our entry and try again.
					lobbyRef.once('value', function(newSnapshot) {							
						lobbyCount = newSnapshot.numChildren();
						if (lobbyCount > MAX_PLAYERS_PER_GAME)	{
							console.log('Too many players in this lobby. Retrying..');
							myUserRef.remove();
							checkLobby(lobbyNum);
						}
					});	

					// Set the location for the start game flag, used by player client to check when to launch the game
					startRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + lobbyNum + '/startGame');
					boardRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + lobbyNum + '/board');

					// Check the game start flag location to see if the lobby we're trying to join has a game in progress
					startRef.once('value', function(data) {
						if (data.val())	{
							// If it does, we increment the lobby and try again from the beginning
							if (data.val().gameStarted) {
								console.log('Lobby game was in progress. Trying next lobby.')
								incrementLobby();
							}
						}
						// If the game is not in progress, continue on...
						else {								
							// Generate a unique reference to a new location for this user
							myUserRef = lobbyRef.child(lobbyCount);

							// Remove this user if they disconnect while in a non-game lobby
							myUserRef.onDisconnect().update({disconnected: true, disconnectTime: Firebase.ServerValue.TIMESTAMP});

							// Get the player's name (this may or may not be displayed to everyone else). For now, this name, along with
							// the player's IP address, will be used to create a unique identifier for the player
							name = prompt("Please enter a unique name", "Player");

							// Check if the name field was empty and if so prompt again. 
							if (name === '') {
								name = prompt("Let's try that again. Please enter a unique name", "Player");
								// If it's empty again, set to generic name
								if (name === '')	{
									name = 'Player';
								}
							}		

							// Sets the user status and enters her information into the lobby
							initializePlayer(lobbyNum, lobbyCount);						
							setReferences(lobbyRef, myUserRef, boardRef);

							// Make sure player is in the lobby view
							$location.path('/lobby');
							
							// Wait for game start
							checkStartStatus(startRef, myUserRef);							
						}
					});							
				}
				else {
					// Check the lobby a second time to make sure no one else connected
					lobbyCheckCounter += 1;
					console.log('Double checking lobby availability..');
					$timeout(function()	{
						checkLobby(lobbyNum);
					}, 1000);					
				}			
			}
			else {
				incrementLobby();
			}
		});
		
	}

	// Increments lobby number and resets the 'double check'
	function incrementLobby()	{
		lobbyCheckCounter = 0;
		// Increment the lobby number 
		lobbyNum += 1;
		// Set the lobby reference to the incremented lobby
		lobbyRef = baseRef.child(LOBBIES_LOCATION + '/' + lobbyNum + '/' + PLAYER_LOCATION);
		// Check the new lobby
		checkLobby(lobbyNum);
	}

	// Initializes the user info if connecting for the first time or returning after an extended period
	function initializePlayer(lobbyNum, lobbyCount) {
		// Create timestamp
		var timestamp = new Date().getTime(),
			date = new Date();

		// Create player object
		var plyrObj = {};

		plyrObj.name = name;
		plyrObj.lobby = lobbyNum;
		plyrObj.ip = myIP;
		plyrObj.uid = name+myIP;
		plyrObj.created = date;
		plyrObj.rawdate = timestamp;
		plyrObj.ref = myUserRef.toString();
		plyrObj.selection = -1;
		plyrObj.score = 0;				
		plyrObj.status = "ready4select";
		if(lobbyCount == 0){
			plyrObj.character = 'turtle';
			plyrObj.player_number = 1;
		}else{
			plyrObj.character = 'rabbit';
			plyrObj.player_number = 2;
		}

		// Set user info
		myUserRef.set(plyrObj);
		recentsRef.push(plyrObj);
		localStorage.setItem('gamePlayer', JSON.stringify(plyrObj));
		wasOnline = true;
	}

	// Called if a player has been disconnected and is returning
	function returnPlayer(playerObject) {
		console.log("It looks like you're re-connecting. Putting you back in your previous lobby");

		// Re-establish references
		lobbyRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + playerObject.lobby + '/' + PLAYER_LOCATION),
		startRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + playerObject.lobby + '/startGame'),
		myUserRef = new Firebase(playerObject.ref);
		boardRef = new Firebase(BASE_URL + '/' + LOBBIES_LOCATION + '/' + playerObject.lobby + '/board');
		

		// Check if this returning player still has their original reference stored in firebase
		checkIfPlayerExists(me).then(function (exists) {
			if (exists)	{
				// Re-establish on-disconnect behavior and remove disconnected flag		
				myUserRef.child('disconnected').remove();	
				myUserRef.onDisconnect().cancel();
				myUserRef.onDisconnect().update({disconnected: true, disconnectTime: Firebase.ServerValue.TIMESTAMP});

				wasOnline = true;

				// Set our references in scope and services
				setReferences(lobbyRef, myUserRef, boardRef);

				if (playerObject.ingame)	{
					console.log("It also looks like you were in a game in progress. Let's put you back there.");
					$scope.gameStarted = true;
					$location.path('/game');
				}
				else {
					$location.path('/lobby');
					// Wait for game start
					checkStartStatus(startRef, myUserRef);	
				}
			}
			// If the player's reference is no longer in firebase, create a new player and find a new lobby
			else {
				initLobby();
			}
		});			
		
	}

	// Asynchronous function used to determine if a player reference exists
	function checkIfPlayerExists(ref)	{
		var deferred = $q.defer();

		ref.once('value', function (data) {
			var exists = (data.val() !== null);

			deferred.resolve(exists);			
		});

		return deferred.promise;
	}

	// Handles setting references in the $scope and in our reference service
	function setReferences(lobbyReference, myUserReference, boardReference) {
		// Sets references to the lobby and to the user to Angular scope variables for use in DOM
		$scope.players = $firebase(lobbyReference);
		$scope.myUserRef = $firebase(myUserReference);
		$scope.board = $firebase(boardReference);

	}

	// Called once the lobby is established, will watch for Experimenter to launch game then countdown to game view navigation
	function checkStartStatus(ref, player)	{
		ref.on('value', function(data) {
			if (data.val()) {
				if (data.val().ready === true && !data.val().gameStarted)	{
					$scope.showCountdown = true;
					// ..remove player ready status..
					player.update({ready: null});
					// ..set gameStarted to true to hide certain elements..
					$scope.gameStarted = true;
					// ..hide the countdown timer..
					$scope.showCountdown = false;
					// ..and navigate to the game view
					$location.path('/game');
				}
			}											
		});
	}

	// When a player clicks the Ready button, this function will toggle their ready state behind the scenes
	$scope.readyUp = function()	{
		var me = myUserRef;
		
		ready = !ready;

		if (ready)	{
			me.update({ready: true});
			//startCheckingPlayers();
		}
		else {
			me.update({ready: null});
			//stopCheckingPlayers();
		}

		$scope.readyText = $scope.readyText === 'Ready' ? 'Unready' : 'Ready';
	};

	// Watch the player's connected status and if they're reconnecting, find a new lobby for them
	connectedRef.on("value", function(isOnline) {
		if (isOnline.val()) {
			console.log('Online');
			if (wasOnline)	{
				checkPlayer();
			}
		} 
		else {
			console.log('Offline');
		}
	});
	
}]);
