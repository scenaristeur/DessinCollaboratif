// personnalisation
var limite_synchro = 3; // gestion synchro si num_clients > limite_synchro
var screenshotDelay = 300000; // 60000 = screenshot toutes les minutes
var screenshotDir = "public/screenshots";


var Twitter = require('twit');
var client;

if (process.env.TWITTER_CONSUMER_KEY != null){
  // utilisation des variables env du serveur
  client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  });
}else{
  //utilisation du fichier de config rename_toconfig.js à renommer en config.js et a completer selon les donnees de https://apps.twitter.com
  // voir https://www.npmjs.com/package/twitter
  var config = require('./config.js');
  client = new Twitter(config);

}
//}

/*client.post('statuses/update', { status: 'hello world!' }, function(err, data, response) {
console.log(data)

})*/

var fs = require('fs');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
/* CONFIGURATION DU SERVEUR WEB */
var port = process.env.PORT || 3010;

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
  console.log(socket.id)
  var precedentSreenshot = lastScreenshot;
  updateTypeSync()
  askForScreenshot()
  infos_clients.num_clients = num_clients;
  io.emit('num_clients', infos_clients);
  if (lastScreenshot != null){
    waitScreenshotUpdate(socket)
  }

  socket.on('line', function(data) {
    //  console.log(data)
    //s'il n'y a pas trop d'utilisateurs, on synchronise en direct, sinon on décalle
    if (typeSync == "sync" ){
      socket.broadcast.emit('line', data);
    }else{
      snapshot.lines.push(data);
    }
  });

  socket.on('snapshotLines', function(data){
    //  console.log(data)
    Array.prototype.push.apply(snapshot.lines,data);
  });

  socket.on('screenshot', function(dataUrl, host){

    if (dataUrl != lastScreenshot){
      lastScreenshot=dataUrl;
      if (client.id != ""){
        postTwitter(dataUrl)
      }

      if (host != "heroku"){
        try {
          var filename = screenshotDir+"/screenshot_"+Date.now()+".png";
          var matches = dataUrl.match(/^data:.+\/(.+);base64,(.*)$/);
          var buffer = new Buffer.from(matches[2], 'base64');
          fs.writeFileSync(filename, buffer);
          updateGalerie(socket);
        }
        catch(error) {
          console.error(error);
          // expected output: SyntaxError: unterminated string literal
          // Note - error messages will vary depending on browser
        }
      }
      else{
        console.log("enregistrement impossible sur heroku")
      }
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

function postTwitter(dataUrl){
  console.log("post")
  var matches = dataUrl.match(/^data:.+\/(.+);base64,(.*)$/);
  var buffer = new Buffer.from(matches[2], 'base64');
  //fs.writeFileSync(filename, buffer);
  //console.log("post 1")
  //var b64content = fs.createReadStream(dataUrl, { encoding: 'base64' })
  /*client.post('statuses/update', { status: 'hello world!' }, function(err, data, response) {
  console.log(data)

})*/
client.post('media/upload', { media_data: buffer.toString('base64') }, function (err, data, response) {
  // now we can assign alt text to the media, for use by screen readers and
  // other text-based presentations and interpreters
  //  console.log("post 2")
  console.log(data)
  //console.log("post 3")
  var mediaIdStr = data.media_id_string
  var altText = "https://dessincollaboratif.herokuapp.com/"
  var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }
  //console.log(meta_params)
  //console.log("post 4")
  client.post('media/metadata/create', meta_params, function (err, data, response) {
    //  console.log("post 5")
    if (!err) {
      // now we can reference the media and post a tweet (media will attach to the tweet)
      var params = { status: ' #dessin #collaboratif  \n sur https://dessincollaboratif.herokuapp.com/ proposé par @DCollaboratif', media_ids: [mediaIdStr] }
      //console.log("post 6")
      client.post('statuses/update', params, function (err, data, response) {
        console.log(data)
        //        console.log("post 7")
      })
    }else{
      //    console.log(err)
    }
  })
})
}
