// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var worker;
var nameFile;
var running = false;
var flag = false;
var delay = 66;
var playbackRate = 2.0;
var canvas = document.createElement('canvas');
var context = canvas.getContext('2d');
var queue = [];
var tabsTarget = [];

var createVideoElement;

function processNextTask(){
	if(running){
		worker.terminate();
		console.log("Worker Terminated.");
	}
	
	if(queue.length < 1){		
		running = false;
		worker.terminate();
		console.log("Worker All Jobs Done");		
		console.log(tabsTarget);		
		
		for (var i=0; i<tabsTarget.length; i++) {
			chrome.tabs.sendMessage(tabsTarget[i], {greeting: "bye"}, function(response){
				console.log(response.farewell);
			});
		}
		tabsTarget = [];
		
		return running;
	}
	
	running = true;		
	console.log("Worker Activates.");
	initWorker();
	console.log("Now Left Task: ",queue.length);
	var src = queue.shift();
	createVideoElement(src);
	return true;
}

function activate(){
	if(running){
		return false;
	}
	
	processNextTask();
}

function initWorker() {
	worker = new Worker('worker.js');	
	worker.onmessage = function (event) {
		console.log("Process Ended");
		chrome.storage.sync.get({
			spcificPathName: false
		}, function(items){
			console.log(items.spcificPathName);
			if(items.spcificPathName){
				console.log("New Window");
				chrome.tabs.create({
					url:"emptyPage.html"
				},function sendImage(targetTab){
					chrome.runtime.onMessage.addListener(
						function(request, sender, sendResponse) {
							if(request.greeting == "reqImage"){
								chrome.tabs.sendMessage(targetTab.id, {
									greeting: "sendImage",
									dataImage: event.data,
									nameOrgin: nameFile
								});
							}
						}
					);
				});
			}	
			else{
				console.log("Auto Download");
				var repreData = "data:image/gif;base64," + event.data;
				chrome.downloads.download({url: repreData, filename: nameFile+".gif" },function(id){});
			}
			processNextTask();
		});
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
	eleVideo.preload = "auto";
	eleVideo.innerHTML = '<source src="' + eleVideo.src + '" type="video/mp4 preload="metadata" />';
};

function uniquelizeArray(arrDuplicated){
	if(arrDuplicated.length < 2){
		return arrDuplicated;
	}	
	
	var arrSorted = arrDuplicated.sort();
	console.log(arrSorted);
	arrDuplicated = [];
	
	console.log(arrSorted);
	
	arrDuplicated.push(arrSorted[0]);
	for (var i = 1; i < arrSorted.length; i++) {
		if(arrSorted[i-1] != arrSorted[i]){
			arrDuplicated.push(arrSorted[i]);
		}
	}
	console.log(arrDuplicated);
	
	return arrDuplicated;	
}

function genericOnClick(info) {
	console.log(info.srcUrl);
	queue.push(info.srcUrl);
	activate();
	
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {greeting: "hello"}, function(response) {
			tabsTarget.push(tabs[0].id);
			tabsTarget = uniquelizeArray(tabsTarget);
			console.log(tabsTarget);
			console.log(response.farewell);
		});
	});
		
}

function saveVideo(info){
	var parsed = info.frameUrl.split("&");
	var idSearch;
	
	for(var i in parsed){
		if(!parsed[i].search("xdm_c")){
			idSearch = parsed[i].split("=")[1];
			console.log(idSearch);
		}
	}
	
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {greeting: "saveVideo", idVideo: idSearch});
	});	
}

chrome.contextMenus.create({"title": "Save as GIF", "contexts":["video"],"onclick": genericOnClick});
chrome.contextMenus.create({"title": "Save this Twitter video", "contexts":["frame"],"onclick": saveVideo});

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse){
		console.log(sender.tab ? "from a content script:" + sender.tab.url :"from the extension");
		if (request.srcVideo){
			console.log("Video finded.");
			chrome.storage.sync.get({spcificPathName: false}, function(items){
				console.log(items.spcificPathName);
				chrome.downloads.download({url: request.srcVideo, saveAs: items.spcificPathName});
			});
		}
		
	}
)

