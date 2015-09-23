// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var worker;
var nameFile;
var flag = false;
var delay = 100;
var widthVideo;
var heightVideo;
var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');

function getDownloadLink(fileData) {
	var blob = new Blob([fileData]);
	chrome.downloads.download({url: window.URL.createObjectURL(blob), filename: nameFile+".gif" },function(id){});
}

function initWorker() {
	worker = new Worker('worker.js');	
	worker.onmessage = function (event) {
		console.log("Process Ended");
		var u8Array = new Uint8Array(atob(event.data).split("").map(function(c){return c.charCodeAt(0); }));
		getDownloadLink(u8Array);		
	};
}

function draw(v,c,w,h) {
	if(v.paused || v.ended)	return false;
	c.drawImage(v,0,0,w,h);
	if(flag == true){	
		var imdata = c.getImageData(0,0,w,h);
		worker.postMessage({frame: imdata});
	}
	setTimeout(draw,delay,v,c,w,h);
}

// A generic onclick callback function.
function genericOnClick(info) {
	console.log(info.srcUrl);
	nameFile = info.srcUrl.substring(info.srcUrl.lastIndexOf('/')+1).split(".")[0];

	var hiddenElement = document.createElement('video');
	hiddenElement.addEventListener("loadedmetadata", function (e) {
		widthVideo = this.videoWidth;
		heightVideo = this.videoHeight;		
		hiddenElement.play();
	}, false );
	hiddenElement.addEventListener("ended", function (e) {
		flag = false;
		console.log("Play Ended");
		worker.postMessage({});
	}, false );	
	hiddenElement.addEventListener('play', function(){
		console.log("Play Start");
		canvas.width = widthVideo;
		canvas.height = heightVideo;
		flag = true;
		worker.postMessage({delay:delay,w:widthVideo,h:heightVideo});		
		draw(this,context,widthVideo,heightVideo);
	},false);
	
	hiddenElement.src = info.srcUrl;
	hiddenElement.playbackRate = 1.0;
	hiddenElement.preload = "metadata";
	hiddenElement.innerHTML = '<source src="' + hiddenElement.src + '" type="video/mp4 preload="metadata" />';
}

// Create one test item for each context type.
var title = "Save as GIF";
var id = chrome.contextMenus.create({"title": title, "contexts":["video"],"onclick": genericOnClick});
initWorker();