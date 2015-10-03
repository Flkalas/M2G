// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var worker;
var nameFile;
var running = false;
var flag = false;
var delay = 80;
var playbackRate = 2.0;
var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');
var queue = [];

var createVideoElement;

function processNextTask(){
	if(queue.length < 1){
		running = false;
		console.log("Worker All Jobs Done");
		return running;
	}
	
	console.log("Now Left Task: ",queue.length);
	var src = queue.shift();
	createVideoElement(src);
	return true;	
}

function activate(){
	if(running){
		return false;
	}
	
	console.log("Worker Activates.");
	running = true;
	processNextTask();
}

function getDownloadLink(fileData){
	var blob = new Blob([fileData]);
	chrome.downloads.download({url: window.URL.createObjectURL(blob), filename: nameFile+".gif" },function(id){});
}

function initWorker() {
	worker = new Worker('worker.js');	
	worker.onmessage = function (event) {
		console.log("Process Ended");
		var u8Array = new Uint8Array(atob(event.data).split("").map(function(c){return c.charCodeAt(0); }));
		getDownloadLink(u8Array);
		processNextTask();
	};
}

function draw(v,c,w,h) {
	if(v.paused || v.ended)	return false;
	c.drawImage(v,0,0,w,h);
	if(flag == true){			
		var imdata = c.getImageData(0,0,w,h);		
		worker.postMessage({frame: imdata});		
	}
	setTimeout(draw,delay/playbackRate,v,c,w,h);
}

createVideoElement = function(src){
	nameFile = src.substring(src.lastIndexOf('/')+1).split(".")[0];
	
	var eleVideo = document.createElement('video');
	
	eleVideo.addEventListener('loadeddata', function(){
		console.log("First frame loaded");
		draw(this,context,this.videoWidth,this.videoHeight);
	}, false );
	eleVideo.addEventListener("loadedmetadata", function (e) {
		console.log("Metadata loaded");		
		eleVideo.play();
	}, false );
	eleVideo.addEventListener("ended", function (e) {
		flag = false;
		console.log("Play ended");
		worker.postMessage({});
	}, false );
	eleVideo.addEventListener('play', function(){		
		console.log("Play start");
		canvas.width = this.videoWidth;
		canvas.height = this.videoHeight;
		worker.postMessage({delay:delay,w:this.videoWidth,h:this.videoHeight});
		flag = true;
	},false);
	
	eleVideo.src = src;
	eleVideo.playbackRate = playbackRate;
	eleVideo.preload = "metadata";
	eleVideo.innerHTML = '<source src="' + eleVideo.src + '" type="video/mp4 preload="metadata" />';	
};

// A generic onclick callback function.
function genericOnClick(info) {
	console.log(info.srcUrl);
	queue.push(info.srcUrl);	
	activate();
}

// Create one test item for each context type.
var title = "Save as GIF";
var id = chrome.contextMenus.create({"title": title, "contexts":["video"],"onclick": genericOnClick});
initWorker();