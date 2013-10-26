/*
* Requires and initialization.
*/
//Dependencies
var http    = require('http'),
    express = require('express'),
    path    = require('path'),
    fs      = require('fs'),
    exec    = require('child_process').exec,
    spawn   = require('child_process').spawn;

var app = express();
var application_root = process.cwd();

/*
* Listening Port
*/
var port = process.env.PORT || 5000,
    server = http.createServer(app).listen(port, function () {
        console.log("Listening on port: " + port);
    }),
    io = require('socket.io').listen(server, { log: false });

var ss = require('socket.io-stream');

/*
* Application Logic
*/

// Config
app.configure(function () {
    app.set('title', 'ReelTime');
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({ secret: 'reeltime' }));
    app.use(express.static(application_root + "/public"));
    app.use(express.compress());
    app.use(app.router);
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});

io.sockets.on('connection', function (socket) {
  socket.on('join', function (room, callback) {
    if(room.hasOwnProperty('name'))
    {
        socket.join(room.name);
        var connections = io.sockets.clients(room.name).length;
        room.connections = connections;
    }
    io.sockets.in(room.name).emit('user:joined', room)
    callback(room);
  });

  socket.on('media:start', function(room) {
    io.sockets.in(room.name).emit('media:select', room);
  });

  socket.on('media:play', function(room) {
    io.sockets.in(room.name).emit('media:play');
  });

  socket.on('media:pause', function(room) {
    io.sockets.in(room.name).emit('media:pause');
  });

  socket.on('media:seeked', function(data) {
    io.sockets.in(data.room.name).emit('media:seeked', data.time);
  });

  ss(socket).on('media:stream', function(stream, data) {
    if(data.type != "video/webm")
    {
      var args = ["-i", "pipe:0", "-vcodec", "libvpx", "-vb", "250k", "-keyint_min", "150", "-g", "150", "-an", "-sn", "-f", "webm", "pipe:1"];
      var ffmpegProc = spawn("ffmpeg", args, {cwd: __dirname + "/temp/"});
      stream.pipe(ffmpegProc.stdin);

      // Handle Errors
      stream.on('error', ffmpegProc.kill);
      ffmpegProc.on("uncaughtException", ffmpegProc.kill);
      ffmpegProc.on("SIGINT", ffmpegProc.kill);
      ffmpegProc.on("SIGTERM", ffmpegProc.kill);

      ffmpegProc.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
      });

      // Handle Data
      ffmpegProc.stdout.on('data', function(chunk) {
        io.sockets.in(data.name).emit('media:chunk', chunk);
      });
        
    }
    else
    {
        stream.on('data', function(chunk) {
          io.sockets.in(data.name).emit('media:chunk', chunk);
        });
    }

  });

  socket.on('media:chunk', function(data) {
    io.sockets.in(data.name).emit('media:chunk', data);
  });

  socket.on('media:complete', function(room) {
    io.sockets.in(room.name).emit('media:complete', room);
  })
});

app.engine('jade', require('jade').__express);
app.set('view engine', 'jade');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/partials/:name', function (req, res) {
    var name = req.params.name;
    res.render('partials/' + name);
});

app.get('*', function (req, res) {
    res.render('index');
});

/*
 * Utility Methods
 */