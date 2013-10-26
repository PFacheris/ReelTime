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
    },
    socket: socket
  };
});

app.factory('SocketStream', function ($rootScope, Socket) {
  return {
    on: function (eventName, stream, callback) {
      ss(Socket.socket).on(eventName, stream, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(Socket.socket, args);
        });
      });
    },
    emit: function (eventName, stream, data, callback) {
      ss(Socket.socket).emit(eventName, stream, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(Socket.socket, args);
          }
        });
      })
    },
    createBlobReadStream: ss.createBlobReadStream,
    createStream: ss.createStream
  };
});

app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
  $routeProvider.when('/', {templateUrl: 'partials/index'});
  $routeProvider.when('/:name', {templateUrl: 'partials/room'});
  $locationProvider.html5Mode(true);
}]);

function RoomCtrl($scope, $routeParams, $location, $timeout, RTCVideo, Socket, SocketStream) {
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

        mediaSource.addEventListener('sourceopen', function(e) {
          var sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');

          sourceBuffer.addEventListener('updatestart', function(e) {
            console.log(e);
          }, false);


          (function(sb) {
            Socket.on('media:chunk', function(data) {
              sb.appendBuffer(new Uint8Array(data));
            });
          })(sourceBuffer);       
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
      Socket.emit('media:start', $scope.room);
      var stream = SocketStream.createStream();
      var data = {
        name: $scope.room.name,
        type: $scope.room.file.type
      }
      SocketStream.emit('media:stream', stream, data);
      SocketStream.createBlobReadStream($scope.room.file).pipe(stream);
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
    if (file.type == "video/quicktime")
    {
      alert("Unfortunately, .mov files are not suppported at this time.");
    }
    else
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
