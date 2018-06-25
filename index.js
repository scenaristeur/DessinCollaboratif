// personnalisation
var limite_synchro = 3; // gestion synchro si num_clients > limite_synchro
var screenshotDelay = 60000; // 60000 = screenshot toutes les minutes

var fs = require('fs');
var express = require('express');
var http = require('http');
var socketio = require('socket.io');

// create the servers
var app = express();
var server = http.Server(app);
var io = socketio(server);


var num_clients = 0;
var tickInterval;
var tickDelay = 150; // 15ms selon source, tempo pour envoi du snapshot par le serveur

var typeSync;
var snapshot = {
  lines: []
};
var infos_clients = {
  num_clients: num_clients,
  limite_synchro: limite_synchro,
  tickDelay: tickDelay
}
var lastScreenshot;

// set port from the environment or fall back
app.set('port', (process.env.PORT || 3010));
// route to static files
app.use(express.static(__dirname + '/public'));

io.on('connection', function(socket) {
  ++num_clients
  if (num_clients == 1){
    startScreenshots()
  }

  var precedentSreenshot = lastScreenshot;
  updateTypeSync()
  askForScreenshot()
  infos_clients.num_clients = num_clients;
  io.emit('num_clients', infos_clients);
    if (lastScreenshot != null){
        waitScreenshotUpdate(socket)
    }




  socket.on('line', function(data) {
    //s'il n'y a pas trop d'utilisateurs, on synchronise en direct, sinon on décalle
    if (typeSync == "sync" ){
      socket.broadcast.emit('line', data);
    }else{
      snapshot.lines.push(data);
    }
  });

  socket.on('snapshotLines', function(data){
    Array.prototype.push.apply(snapshot.lines,data);
  });

  socket.on('screenshot', function(dataUrl){

    if (dataUrl != lastScreenshot){
    //  console.log('screenshot')
      lastScreenshot=dataUrl;
      var filename = "screenshots/screenshot_"+Date.now()+".png";
      var matches = dataUrl.match(/^data:.+\/(.+);base64,(.*)$/);
      var buffer = new Buffer(matches[2], 'base64');
      fs.writeFileSync(filename, buffer);
    }else{
    //  console.log('screenshot identique')
    }
  });

  socket.on('disconnect', function(data) {
    --num_clients;
    updateTypeSync()
    askForScreenshot()
    infos_clients.num_clients =num_clients;
    io.emit('num_clients', infos_clients);
    if (num_clients < 1){
      console.log("STOP screenshots")
        clearInterval(screenshotInterval);
    }
  });
});

// listen
server.listen(app.get('port'), function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('listening at http://%s:%s', host, port);
});


function startScreenshots(){
  console.log("start Screenshots")
  screenshotInterval = setInterval(function() {
  askForScreenshot();
  }, screenshotDelay);
}

function updateSnapshot() {
  //console.log("update");
  snapshot.num_clients = num_clients;
  //console.log(snapshot);
  var d = new Date();
  var n = d.getSeconds();
  snapshot.tick = n;
}

function askForScreenshot(){
  io.clients((error, clients) => {
    if (error) throw error;
  //  console.log(clients); // => [6em3d4TJP8Et9EMNAAAA, G5p55dHhGgUnLUctAAAB]
    var client0 = clients[0];
  //  console.log(client0)
    io.to(client0).emit('screenshot')
  });
}
function updateTypeSync(){
  if( num_clients < limite_synchro){
    typeSync = "sync"
    if(snapshot.lines.length >0){
      updateSnapshot();
      console.log("tock");
      io.emit('tick', snapshot);
      //socket.broadcast.emit('tick', snapshot);
      snapshot.lines = new Array();
    }
    clearInterval(tickInterval);
  }else{
    typeSync = "async"
    launchAsync()
  }
  infos_clients.typeSync = typeSync;
  console.log("\n############### "+typeSync + " "+num_clients)
}


function launchAsync(){
  tickInterval = setInterval(function() {
    //A intervalles réguliers, on envoie à tout utilisateur connecté, un snapshot des dernières modifications et on réinitialise les lines stockées dans le snapshot
    //  console.log("tick");
    //    console.log(snapshot);
    if(snapshot.lines.length >0){
      updateSnapshot();
      //    console.log("tock");
      io.emit('tick', snapshot);
      //socket.broadcast.emit('tick', snapshot);
      snapshot.lines = new Array();
    }
  }, tickDelay);
}

function waitScreenshotUpdate(socket){
  var precedentSreenshot = lastScreenshot
    if(lastScreenshot != precedentSreenshot) {//we want it to match
      console.log("wait")
        setTimeout(waitScreenshotUpdate, 50);//wait 50 millisecnds then recheck
        return;
    }
  //  if (lastScreenshot != null){
  console.log("ok")
        socket.emit('lastScreenshot', lastScreenshot)
  //  }
  //  something_cachedValue=something;
    //real action
}
