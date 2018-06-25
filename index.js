// personnalisation
var limite_synchro = 10; // gestion synchro si num_clients > limite_synchro
var screenshotDelay = 60000; // 60000 = screenshot toutes les minutes
var screenshotDir = "public/screenshots";

var fs = require('fs');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
/* CONFIGURATION DU SERVEUR WEB */
var port = process.env.PORT || 3010;

var num_clients = 0;
var tickInterval;
var tickDelay = 15; // 15ms selon source, tempo pour envoi du snapshot par le serveur

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

server.listen(port, function() {
  console.log('Server listening at port %d', port);
});
// route to static files
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/public/screenshots'));
app.get('*', function(req, res){
  res.sendFile("/public/index.html", {root: '.'});
});

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
      lastScreenshot=dataUrl;
      var filename = screenshotDir+"/screenshot_"+Date.now()+".png";
      var matches = dataUrl.match(/^data:.+\/(.+);base64,(.*)$/);
      var buffer = new Buffer(matches[2], 'base64');
      fs.writeFileSync(filename, buffer);
      updateGalerie(socket);
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

function updateGalerie(socket){
  var files = getFiles(screenshotDir).reverse();
  //  console.log(galeryFiles)
  var galeryFiles = files.map(function(f) {
    f = f.replace( 'public','')
    return f;
  });
  socket.broadcast.emit('galery', galeryFiles);
}

function startScreenshots(){
  console.log("start Screenshots")
  screenshotInterval = setInterval(function() {
    askForScreenshot();
  }, screenshotDelay);
}

function updateSnapshot() {
  snapshot.num_clients = num_clients;
  //  var d = new Date();
  //  var n = d.getSeconds();
  //  snapshot.tick = n;
}

function askForScreenshot(){
  io.clients((error, clients) => {
    if (error) throw error;
    var client0 = clients[0];
    io.to(client0).emit('screenshot')
  });
}

function updateTypeSync(){
  if( num_clients < limite_synchro){
    typeSync = "sync"
    if(snapshot.lines.length >0){
      updateSnapshot();
      io.emit('tick', snapshot);
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
    if(snapshot.lines.length >0){
      updateSnapshot();
      io.emit('tick', snapshot);
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
  console.log("envoi lastscreenshot")
  socket.emit('lastScreenshot', lastScreenshot)
}

function getFiles (dir, files_){
  files_ = files_ || [];
  var files = fs.readdirSync(dir);
  for (var i in files){
    var name = dir + '/' + files[i];
    if (fs.statSync(name).isDirectory()){
      getFiles(name, files_);
    } else {
      files_.push(name);
    }
  }
  return files_;
}
