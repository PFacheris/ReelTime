var app = angular.module('movieApp', []);

app.factory('RTCVideo', function() {
	var connection = new RTCMultiConnection();
	connection.session = 'audio + video';

	return {
		start: function(room) {
			if(room.connections === 1)
	        	connection.open(room.name);
	        else
	        	connection.connect(room.name);

	        connection.onstream = function (stream) {
	            if (stream.type === 'local') {
	                $('#me').append(stream.mediaElement);
	            }

	            if (stream.type === 'remote') {
	                $('#friend').append(stream.mediaElement);
	            }
	        }
		}
	}
});

app.factory('Socket', function ($rootScope) {
  var socket = io.connect();
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    }
  };
});

app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
  $routeProvider.when('/', {templateUrl: 'partials/index'});
  $routeProvider.when('/:name', {templateUrl: 'partials/room'});
  $locationProvider.html5Mode(true);
}]);

function RoomCtrl($scope, $routeParams, $location, $timeout, RTCVideo, Socket) {
	RoomCtrl.prototype.$scope = $scope;
	RoomCtrl.prototype.Socket = Socket;
	this.init = function() {
		$scope.room = $routeParams;
		if (window.File && window.FileReader && window.FileList && window.Blob) {
			Socket.emit('join', $scope.room, function(room) {
				$scope.room = room;	
				RTCVideo.start($scope.room);
			});

			Socket.on('media:select', function(room) {
				$scope.room = room;
				$('#play').addClass('disabled');
				$('#file-button').addClass('disabled');
			});

			Socket.on('media:play', function() {
				$('.stream-main')[0].play();
			});

			Socket.on('media:pause', function() {
				$('.stream-main')[0].pause();
			});

			Socket.on('media:seeked', function(time) {
				if($('.stream-main')[0].currentTime != time)
					$('.stream-main')[0].currentTime = time;
			});

			Socket.on('user:joined', function(room){
				$scope.room = room;
			});

			$timeout(loadMediaSource, 500)
			function loadMediaSource() {
				var video = $('.stream-main')[0];

				window.MediaSource = window.MediaSource || window.WebKitMediaSource;
				if (!!!window.MediaSource) {
				  alert('MediaSource API is not available');
				}
				var mediaSource = new MediaSource();

				video.src = window.URL.createObjectURL(mediaSource);

				mediaSource.addEventListener('webkitsourceopen', function(e) {
				  	var sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');

					Socket.on('media:chunk', function(data) {
						sourceBuffer.append(new Uint8Array(data.data));
					});		  	
				}, false);

				video.addEventListener('seeked', function (e) {
					Socket.emit('media:seeked', {room: {name: $scope.room.name}, time: video.currentTime})
				});
			}
			

		} 
		else {
  			alert('This browser is not supported. Please use the latest versions of Chrome or Firefox.');
  			$location.path("/");
		}
	}

	this.handleUploadClick = function() {
		$('#file').click();
	}

	this.sendFile = function() {
		if($scope.room.file)
		{
			//const NUM_CHUNKS = 1000;
			Socket.emit('media:start', $scope.room);
			var chunkSize = 4096;//Math.ceil($scope.room.file.size / NUM_CHUNKS);
			const NUM_CHUNKS = Math.ceil($scope.room.file.size/ chunkSize);
		    // Slice the video into NUM_CHUNKS and append each to the media element.
		    var i = 0;

		    (function readChunk_(i) {
		      var reader = new FileReader();

		      // Reads aren't guaranteed to finish in the same order they're started in,
		      // so we need to read + append the next chunk after the previous reader
		      // is done (onload is fired).
		      reader.onload = function(e) {
		        var data = {
					    "data" : new Uint8Array(e.target.result),
					    "sequence" : i,
					    "name": $scope.room.name
					};
			        Socket.emit("media:chunk", data);
		      };

		      var startByte = chunkSize * i;
		      var chunk = $scope.room.file.slice(startByte, startByte + chunkSize);

		      reader.readAsArrayBuffer(chunk);
		      if (i != NUM_CHUNKS - 1)
			  	readChunk_(++i);
		    })(i);
		}
		else
			alert('Select a file.');
	}

	this.init();

	$scope.RoomCtrl = this
}

RoomCtrl.prototype.setFile = function(element) {
    var $scope = this.$scope;
    var file = element.files[0];
    if (file.type.match('.webm'))
    {
	    $scope.$apply(function() {
	        $scope.room.file = file;
	        $.getJSON('http://imdbapi.org/?q=' + file.name.substring(0, file.name.indexOf('.')), function(data, status)
	        {
	        	$scope.room.imdb = {};
	        	$scope.room.imdb.title = data[0].title;
	        	$scope.room.imdb.rating = data[0].rating;
	        	$scope.room.imdb.img = data[0].poster;
	        });
	    });
	}
	else
		alert('Invalid File Type, WebM support only.')
};

RoomCtrl.prototype.pause = function() {
	var $scope = this.$scope;
	var Socket = this.Socket;
    Socket.emit('media:pause', $scope.room);
};

RoomCtrl.prototype.play = function() {
	var $scope = this.$scope;
	var Socket = this.Socket;
    Socket.emit('media:play', $scope.room);
};
