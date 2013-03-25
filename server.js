var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

Buffer.prototype.toByteArray = function () {
  return Array.prototype.slice.call(this, 0)
};

io.enable('browser client minification');  // send minified client
//io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('log level', 1);                    // reduce logging

server.listen(9000);

app.use("/css", express.static('css'));
app.use("/js", express.static('js'));
app.use("/images", express.static('js'));

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
  socket.on('classify', function (data) {
    camera.read(function(im) {
      var smallImage = im.copy();
      smallImage.resize(im.width()/scaleFactor, im.height()/scaleFactor);

      smallImage.detectObject("./haarcascade_frontalface_alt.xml", {neighbors: 3}, function(err, faces) {
        for (var i in faces){
          var face = faces[i];

          var faceDetected = {
            x: face.x*scaleFactor,
            y: face.y*scaleFactor,
            width: face.width*scaleFactor,
            height: face.height*scaleFactor
          };

          if (faceDetected.x <= data.x && faceDetected.x + faceDetected.width >= data.x && faceDetected.y <= data.y && faceDetected.y + faceDetected.height >= data.y) {
            var croppedImage = new cv.Matrix(im, face.x*scaleFactor, face.y*scaleFactor, face.width*scaleFactor, face.height*scaleFactor);

            if (trainingData.length) {
              croppedImage.resize(trainingSize.width, trainingSize.height);

              var prediction = facerec.predictSync(croppedImage);
              faceDetected.label = prediction.id;
              faceDetected.confidence = prediction.confidence;
            }

            //TODO: set jpg quality here instead of hard coded in Matrix.cc
            socket.emit("snapshot", {faces: faceDetected, image: croppedImage.toBuffer().toByteArray()});
            break;
          }
        }
      });
    });
  });

  socket.on('identify', function (data) {
    var snapshot = new Buffer(data.snapshot);
  	cv.readImage(snapshot, function(err, im) {
      var faceId;
        
      for (var a = 0; a < trainingData.length; a++) {
        if (trainingData[a].name == data.name) {
          faceId = a;
          break;
        }
      }
        
      if (faceId == undefined) {
        trainingData.push({name: data.name});
        var trainingImage = [[0, im]];
        facerec.trainSync(trainingImage);
      }
      else {
        var trainingImage = [[faceId, im]];
        facerec.updateSync(trainingImage);      
      }
  	});
  });
});

var startTime = 0;
var frameCount = 0;

var cv = require('opencv');
var camera = new cv.VideoCapture(0);

var scaleFactor = 4;
var trainingSize = {
  width: 92,
  height: 112
};
var trainingData = [];
var facerec = new cv.FaceRecognizer();

/*
for (var i = 1; i< 41; i++){
  for (var j = 1; j<10; j++){
    trainingData.push([i,"./Cambridge_FaceDB/s" + i + "/" + j + ".pgm" ])
  }
}

facerec.trainSync(trainingData);
*/

var stream = camera.toStream();
stream.read();
stream.on("data", function(im) {
  stream.pause();
  if (startTime == 0) {
    startTime = new Date().getTime();
  }
  frameCount++;
  //console.log("FPS: "+frameCount / (((new Date().getTime()) - startTime)/1000));

  if (frameCount % 10) {
    //TODO: set jpg quality here instead of hard coded in Matrix.cc
    io.sockets.emit("frameUpdate", { width: im.width(), height: im.height(), image: im.toBuffer().toByteArray() });
    process.nextTick(function() { stream.resume(); });
  }
  else {
    var smallImage = im.copy();
    smallImage.resize(im.width()/scaleFactor, im.height()/scaleFactor);

    smallImage.detectObject("./haarcascade_frontalface_alt.xml", {neighbors: 3}, function(err, faces) {

      var facesDetected = [];

      for (var i in faces){
        var face = faces[i];
        var faceDetected = {
          x: face.x*scaleFactor,
          y: face.y*scaleFactor,
          width: face.width*scaleFactor,
          height: face.height*scaleFactor
        };

        if (trainingData.length) {
          var croppedImage = new cv.Matrix(im, face.x*scaleFactor, face.y*scaleFactor, face.width*scaleFactor, face.height*scaleFactor);
          croppedImage.resize(trainingSize.width, trainingSize.height);

          var prediction = facerec.predictSync(croppedImage);
          faceDetected.id = prediction.id;
          faceDetected.confidence = prediction.confidence;
          console.log("predict "+faceDetected.id+" with conf "+faceDetected.confidence);
          
          if (trainingData[prediction.id] != undefined) {
            faceDetected.name = trainingData[prediction.id].name
            console.log("name:"+faceDetected.name)
          }
        }

        facesDetected.push(faceDetected);
      }

      //TODO: set jpg quality here instead of hard coded in Matrix.cc
      io.sockets.emit("frameUpdate", { faces: facesDetected, width: im.width(), height: im.height(), image: im.toBuffer().toByteArray() });
      process.nextTick(function() { stream.resume(); });
    });
  }
});
