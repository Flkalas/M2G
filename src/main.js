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

var queueReadytoJoinVideo = [];
var queueJoinVideo = []
var videoBuffer = new Uint8Array(0);

var createVideoElement;

function downloadMP4(src){
	chrome.storage.sync.get({
			spcificPathName: false,
			isSaveMP4: false
		}, function(items){
		console.log(items);
		if(items.isSaveMP4){			
			chrome.downloads.download({url: src, saveAs: items.spcificPathName});
		}
	});
	
}

function convertGIF(src){
	chrome.storage.sync.get({
			isConvertGIF: true
		}, function(items){
		console.log(items);
		if(items.isConvertGIF){	
			running = true;		
			console.log("Worker Activates.");
			initWorker();
			console.log("Now Left Task: ",queue.length);
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
				chrome.tabs.sendMessage(tabs[0].id, {greeting: "hello"}, function(response) {
					tabsTarget.push(tabs[0].id);
					tabsTarget = uniquelizeArray(tabsTarget);
					console.log(tabsTarget);
					console.log(response.farewell);
				});
			});
			createVideoElement(src);
		}
	});	
}

function processNextTask(){
	if(queue.length < 1){		
		running = false;		
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
	else{
		var src = queue.shift();
		downloadMP4(src);
		convertGIF(src);
		processNextTask();
		return true;		
	}
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
			worker.terminate();
			console.log("Worker Terminated.");
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
	console.log(info);	
	queue.push(info.srcUrl);
	activate();

}

function downloadVideo(request){
	if (request.srcVideo){
		console.log("Video finded.");
		console.log(request.srcVideo);
		chrome.storage.sync.get({spcificPathName: false}, function(items){
			console.log(items.spcificPathName);
			chrome.downloads.download({url: request.srcVideo, saveAs: items.spcificPathName});
		});
	}
}

function downloadTsVideo(data){
	if (data){
		console.log("Video encoded.");
		//console.log(request.srcVideo);
		chrome.storage.sync.get({spcificPathName: false}, function(items){
			console.log(items.spcificPathName);
			chrome.downloads.download({url: data, saveAs: items.spcificPathName, filename: nameFile+".ts"});
		});
	}
}

function parseVmapPage(url){
	var xhr = new XMLHttpRequest();
	xhr.onload = function (e) {
		if ((xhr.readyState === 4) && (xhr.status === 200)) {
			console.log("Vmap download complete. parsing...");
			var targetVideoSource = xhr.responseText.substring(xhr.responseText.search("http://amp.twimg.com"),xhr.responseText.length-1).split(']')[0];			
			console.log(targetVideoSource);
			downloadVideo({"srcVideo": targetVideoSource});
		}
	}
	xhr.open('GET', url, true);
	xhr.send(null);
}

function parsePlaylist(url){
	nameFile = url.substring(url.lastIndexOf('/')+1).split(".")[0];
	//console.log("nameFile: ", nameFile);	
	var xhr = new XMLHttpRequest();
	xhr.onload = function (e) {
		if ((xhr.readyState === 4) && (xhr.status === 200)) {
			console.log("Playlist download complete. parsing...");			
			var targetPlaylist = findMaxBandwidthSource(xhr.responseText);
			console.log(targetPlaylist);
			downloadPlaylist(targetPlaylist);
		}
	}
	xhr.open('GET', url, true);
	xhr.send(null);
}

function downloadPlaylist(url){
	if(url == ""){
		return -1;
	}
	
	var xhr = new XMLHttpRequest();
	xhr.onload = function (e) {
		if ((xhr.readyState === 4) && (xhr.status === 200)) {
			console.log("Maximum bandwidth playlist download complete. download...");			
			var targetPlaylist = getTotalPlaylist(xhr.responseText);			
			activateSequence(targetPlaylist);
			//downloadVideo({"srcVideo": targetVideoSource});
		}
	}
	xhr.open('GET', url, true);
	xhr.send(null);
}

function activateSequence(arrUrls){
	queueReadytoJoinVideo.push(arrUrls);
	console.log(queueReadytoJoinVideo);
	
	if(queueJoinVideo.length == 0){
		processNextVideo();
	}
}

function processNextVideo(){
	if(queueReadytoJoinVideo.length > 0){
		queueJoinVideo = queueReadytoJoinVideo.shift();
		console.log(queueJoinVideo);
		accumTsFragment();
	}	
}

function accumTsFragment(){
	if(queueJoinVideo.length > 0){
		var nowURL = queueJoinVideo.shift();
		//console.log(queueJoinVideo.length, nowURL);		
		downloadTsFragment(nowURL);		
	}else{
		//console.log(videoBuffer.length);
		//console.log(videoBuffer);
		
		var b64 = "data:video/mp2t;base64," + u8aToB64(videoBuffer);
		
		//console.log(b64.length);
		
		downloadTsVideo(b64);
		
		//downloadByWorker(Uint8ToString(videoBuffer));
		
		videoBuffer = new Uint8Array(0);
	}
}

function downloadByWorker(uint8string) {
	worker = new Worker('workerB64.js');
	worker.onmessage = function (event) {
		console.log("Process Ended");
		
		console.log(event.data.length);
		
		console.log("Worker Terminated.");
		worker.terminate();
		processNextVideo();
	
	};
	worker.postMessage({string: uint8string});
}

function Uint8ToString(u8a){
	var CHUNK_SZ = 0x8000;
	var c = [];
	for (var i=0; i < u8a.length; i+=CHUNK_SZ) {
		c.push(String.fromCharCode.apply(null, u8a.subarray(i, i+CHUNK_SZ)));
	}
	return c.join("");
}

function u8aToB64(uInt8Array){
	return btoa(Uint8ToString(uInt8Array));
}

function downloadTsFragment(urlTs){
	var xhr = new XMLHttpRequest();
	xhr.responseType = "arraybuffer";
	xhr.onload = function (e) {
		var arrayBuffer = xhr.response;
		if (arrayBuffer) {			
			var now = new Uint8Array(arrayBuffer);
			var prev = new Uint8Array(videoBuffer);
			
			videoBuffer = new Uint8Array(now.length + prev.length);
			videoBuffer.set(prev);
			videoBuffer.set(now, prev.length);
			
			//console.log(videoBuffer.length, now.length, prev.length);			
			accumTsFragment();
		}
	}
	xhr.open('GET', urlTs, true);
	xhr.send(null);
}

function getTotalPlaylist(string){
	var stringsSplited = string.split("#");
	var arrPlaylist = [];
	for(var i in stringsSplited){		
		if(stringsSplited[i].search("ext_tw_video")>0){			
			//console.log(i,stringsSplited[i].split("\n")[1]);
			arrPlaylist.push("https://video.twimg.com"+stringsSplited[i].split("\n")[1]);
		}
	}

	return arrPlaylist;
}

function findBandwidth(sourcePlaylist){
	var stringsSplited = sourcePlaylist.split(",");
	for(var i in stringsSplited){		
		if(stringsSplited[i].search("BANDWIDTH") == 0){
			//console.log(i,stringsSplited[i],stringsSplited[i].split("=")[1]);
			return Number(stringsSplited[i].split("=")[1]);
		}
	}
	return -1;
}

function findPlaylistSource(sourcePlaylist){
	var stringsSplited = sourcePlaylist.split("\n");
	for(var i in stringsSplited){
		//console.log(i,stringsSplited[i]);
		if((stringsSplited[i].search("ext_tw_video")>0)&&(stringsSplited[i].search("m3u8")>0)){
			return "https://video.twimg.com"+stringsSplited[i];
		}
	}
	return "";
}

function findMaxBandwidthSource(string){
	var stringsSplited = string.split("#");
	var arrBandwidth = [];
	for(var i in stringsSplited){		
		var bandwidth = findBandwidth(stringsSplited[i]);
		//console.log(i,stringsSplited[i],bandwidth);
		if(bandwidth > 0){
			arrBandwidth.push(bandwidth);
		}
	}

	var bandwidthMax = Math.max.apply(null,arrBandwidth);
	//console.log(arrBandwidth, bandwidthMax);
	
	for(var i in stringsSplited){
		if(bandwidthMax == findBandwidth(stringsSplited[i])){
			//console.log(i,stringsSplited[i],bandwidthMax);
			return findPlaylistSource(stringsSplited[i]);			
		}
	}
	return "";
}

function saveVideo(info){
	console.log(info);
	
	var parsed = info.frameUrl.split("&");	
	var idSearch;
	var isNewType = true;
	
	for(var i in parsed){
		if(!parsed[i].search("xdm_c")){
			idSearch = parsed[i].split("=")[1];
			console.log("It is video.");
			isNewType = false;
			console.log(idSearch);
			
			chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
				chrome.tabs.sendMessage(tabs[0].id, {greeting: "saveVideo", idVideo: idSearch});
			});	
		}		
	}
	
	if(isNewType){
		console.log("It is NEW type.");
		var isNotTweetDeck = true;
		
		console.log(info.frameUrl);
		var parsed = info.frameUrl.split('&');
		for(var i in parsed){
			if((parsed[i].search("video.twimg.com")>0)&&(parsed[i].search("mp4")>0)){
				var videoUrl = parsed[i].split('=');
				console.log("TweetDeck Video.");
				console.log(videoUrl[1]);
				isNotTweetDeck = true;
				downloadVideo({"srcVideo": videoUrl[1]});				
				break;
			}
		}
		
		if(isNotTweetDeck){
			var xhr = new XMLHttpRequest();
			xhr.onload = function (e) {
				if (xhr.readyState === 4) {
					if (xhr.status === 200) {					
						var parsed = xhr.responseText.replace(/&quot;/g,'"').replace(/\\/g, '').split('"');					
						for(var i in parsed){
							if((parsed[i].search("pbs.twimg.com")>0)&&(parsed[i].search("mp4")>0)){
								console.log("And it is GIF.");
								console.log(parsed[i]);
								genericOnClick({"srcUrl": parsed[i]});
								break;
							}
							else if((parsed[i].search("video.twimg.com")>0)&&(parsed[i].search("mp4")>0)){
								console.log("And it is Easy Video.");
								console.log(parsed[i]);
								downloadVideo({"srcVideo": parsed[i]});
								break;
							}
							else if((parsed[i].search("video.twimg.com")>0)&&(parsed[i].search("m3u8")>0)){
								console.log("And it is Playlist.");
								console.log(parsed[i]);
								parsePlaylist(parsed[i]);
								break;
							}
							else if((parsed[i].search("amp.twimg.com")>0)&&(parsed[i].search("vmap")>0)){
								console.log("And it is Hard Video.");
								console.log(parsed[i]);
								parseVmapPage(parsed[i]);
								break;
							}
						}
					}
				}
			}
			xhr.open('GET', info.frameUrl, true);
			xhr.send(null);
		}
	}
}

chrome.contextMenus.create({"title": "Save as GIF", "contexts":["video"],"onclick": genericOnClick});
chrome.contextMenus.create({"title": "Save this Twitter video", "contexts":["frame"],"onclick": saveVideo});

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse){
		console.log(sender.tab ? "from a content script:" + sender.tab.url :"from the extension");
		downloadVideo(request)		
	}
)

