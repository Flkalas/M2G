// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var worker;
var dataVideo;
var nameFile;
var running = false;
var isWorkerLoaded = false;

function isReady() {
  return !running && isWorkerLoaded && dataVideo;
}

function parseArguments(text) {
  text = text.replace(/\s+/g, ' ');
  var args = [];
  // Allow double quotes to not split args.
  text.split('"').forEach(function(t, i) {
    t = t.trim();
    if ((i % 2) === 1) {
      args.push(t);
    } else {
      args = args.concat(t.split(" "));
    }
  });
  return args;
}

function runCommand(text) {
  if (isReady()) {
    running = true;
    var args = parseArguments(text);
    console.log(args);
    worker.postMessage({
      type: "command",
      arguments: args,
      files: [
        {
          "name": "input.mp4",
          "data": dataVideo
        }
      ]
    });
  }
}

function getDownloadLink(fileData, fileName) {
  //var a = document.createElement('a');
  //a.download = fileName;
	var blob = new Blob([fileData]);
	chrome.downloads.download({url: window.URL.createObjectURL(blob), filename: nameFile+".gif" },
	function(id){});
}

function initWorker() {
  worker = new Worker("worker-asm.js");
  worker.onmessage = function (event) {
    var message = event.data;
    if (message.type == "ready") {
      isWorkerLoaded = true;
	  // console.log("Worker Ready");
    // } else if (message.type == "stdout") {
      // console.log(message.data);
    // } else if (message.type == "start") {
      // console.log("Worker has received command");
    } else if (message.type == "done") {
      running = false;
      var buffers = message.data;
      // if (buffers.length) {
			// console.log("Work Success");
      // }
	  buffers.forEach(function(file) {
        getDownloadLink(file.data, file.name);
      });
    }
  };
}

function retrieveVideo(url) {
	var oReq = new XMLHttpRequest();
	nameFile = url.substring(url.lastIndexOf('/')+1).split(".")[0];
	//console.log(nameFile)
	oReq.onload = function (oEvent) {
		var arrayBuffer = oReq.response;
		if (arrayBuffer) {
			dataVideo = new Uint8Array(arrayBuffer);
			//console.log(dataVideo);
			runCommand("-i input.mp4 -vf showinfo,scale=w=-1:h=-1 -strict experimental -v verbose -pix_fmt pal8 -y output.gif");
		}
	};	
	
	oReq.open("GET", url, true);
	oReq.responseType = "arraybuffer";
	oReq.send(null);
}

// A generic onclick callback function.
function genericOnClick(info) {
	console.log("item " + info.menuItemId + " was clicked");
	//console.log(info.srcUrl);	
	retrieveVideo(info.srcUrl);
}

// Create one test item for each context type.
var title = "Save as GIF";
var id = chrome.contextMenus.create({"title": title, "contexts":["video"],"onclick": genericOnClick});
//console.log("'video' item:" + id);
initWorker();


