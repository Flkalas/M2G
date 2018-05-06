// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var worker;
var nameFileGIF;
var nameFileTS;
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
									nameOrgin: nameFileGIF
								});
							}
						}
					);
				});
			}	
			else{
				console.log("Auto Download");
				var u8Array = new Uint8Array(atob(event.data).split("").map(function(c){return c.charCodeAt(0); }));
				var blob = new Blob([u8Array],{type:'image/gif'});
				var url = URL.createObjectURL(blob);
				console.log(url);
				//var repreData = "data:image/gif;base64," + event.data;
				chrome.downloads.download({url: url, filename: nameFileGIF+".gif" },function(id){});
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
	nameFileGIF = src.substring(src.lastIndexOf('/')+1).split(".")[0];
	
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
		console.log("Video fragment merged.");
		//console.log(request.srcVideo);
		chrome.storage.sync.get({spcificPathName: false}, function(items){			
			var blob = new Blob([data],{type:'video/mp2t'});
			var url = URL.createObjectURL(blob);

			console.log(url);
			chrome.downloads.download({url: url, saveAs: items.spcificPathName, filename: nameFileTS+".ts"});
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
	nameFileTS = url.substring(url.lastIndexOf('/')+1).split(".")[0];
	console.log("nameFile: ", nameFileTS);
	var xhr = new XMLHttpRequest();
	xhr.onload = function (e) {
		if ((xhr.readyState === 4) && (xhr.status === 200)) {
			console.log("Playlist download complete. parsing...");			
			var targetPlaylist = findMaxBandwidthSource(xhr.responseText);
			console.log("Finded Max bandwidth playlist: "+targetPlaylist);
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
	}
	else{
		downloadTsVideo(videoBuffer);
		videoBuffer = new Uint8Array(0);
	}
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
	//console.log("playlist string\n"+string);
	var arrPlaylist = [];
	for(var i in stringsSplited){		
		if((stringsSplited[i].search("ext_tw_video")>0)||(stringsSplited[i].search("amplify_video")>0)){			
			//console.log(i,stringsSplited[i].split("\n")[1]);
			arrPlaylist.push("https://video.twimg.com"+stringsSplited[i].split("\n")[1]);
		}
	}

	return arrPlaylist;
}

function findBandwidth(sourcePlaylist){
	var stringsSplited = sourcePlaylist.split(",");
	for(var i in stringsSplited){
		//console.log(i,stringsSplited[i]);
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
		if(((stringsSplited[i].search("ext_tw_video")>0)||(stringsSplited[i].search("amplify_video")>0))&&(stringsSplited[i].search("m3u8")>0)){
			//console.log("Finded Max bandwidth playlist: https://video.twimg.com"+stringsSplited[i]);
			return "https://video.twimg.com"+stringsSplited[i];
		}
	}
	return "";
}

function findMaxBandwidthSource(string){
	var stringsSplited = string.split("#");
	var arrBandwidth = [];
	//console.log(string);
	for(var i in stringsSplited){		
		var bandwidth = findBandwidth(stringsSplited[i]);
		//console.log(i,stringsSplited[i],bandwidth);
		if(bandwidth > 0){
			arrBandwidth.push(bandwidth);
		}
	}

	var bandwidthMax = Math.max.apply(null,arrBandwidth);
	console.log("Max bandwidth: ", bandwidthMax, arrBandwidth);
	
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
								console.log(parsed[i]);
								if((parsed[i].search("tweet_video")>0)){
									console.log("And it is GIF Video.");
									genericOnClick({"srcUrl": parsed[i]});
								}
								else if((parsed[i].search("ext_tw_video")>0)){
									console.log("And it is Easy Video.");
									downloadVideo({"srcVideo": parsed[i]});
								}
								else{
									console.log("And it Else. New Type. Try Video Download");
									downloadVideo({"srcVideo": parsed[i]});
								}
								//ext_tw_video/825701990357467137/pu/vid/480x480/LacAfZrEY6VN_JVm.mp4
								//video.twimg.com/tweet_video/C3YnkIPVUAEhM9Z.mp4
								
								
								//genericOnClick({"srcUrl": parsed[i]});
								//downloadVideo({"srcVideo": parsed[i]});
								break;
							}
							else if((parsed[i].search("video.twimg.com")>0)&&(parsed[i].search("m3u8")>0)){									
								detectedVideo(parsed,i);
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

function detectedVideo(parsed,i){
	console.log("And it is Playlist.");
	console.log(parsed[i]);
	chrome.storage.sync.get({isVideoSaveAsMP4: true, isVideoSaveAsTS: true}, function(items){
		console.log("Twitter Video save as");
		console.log("MP4", items.isVideoSaveAsMP4);
		console.log("TS", items.isVideoSaveAsTS);
		
		if(items.isVideoSaveAsMP4){
			var j = i;
			while((parsed[j].search("twitter.com")<1)||(parsed[j].search("status")<1)||(parsed[j].search("video")<1)){
				j++;
			}			
			var targetURL = parsed[j].replace("twitter.com", "mobile.twitter.com");
			console.log(targetURL);
			//downloadMobileMP4(targetURL);
		}
		if(items.isVideoSaveAsTS){
			parsePlaylist(parsed[i]);
		}
	});
}

// var loadCheck
// loadCheck = function(tabId , info) {
	// if (info.status == "complete") {
		// tabId){
			
		// }
	// }
// }

function downloadMobileMP4(targetURL){
	
	chrome.tabs.create({url: targetURL});
	
	// chrome.tabs.create({url: targetURL},function(tab){		
		// chrome.tabs.sendMessage(tab.id, {greeting: "saveMP4Video"});
		// setTimeout(function(){
			// console.log(tab);			
		// },10000);
	// });
	
	

	//var refererURL = targetURL.replace("/video/1","");
	
	// chrome.webRequest.onBeforeSendHeaders.addListener(removeHeaderCookie,
	// {urls: ["https://mobile.twitter.com/*/status/*","http://mobile.twitter.com/*/status/*"],
	// types: ["main_frame", "sub_frame", "xmlhttprequest"]}
	// ,["blocking", "requestHeaders"]
	// );
	
	//console.log(refererURL);
	
	// var xhr = new XMLHttpRequest();
	// xhr.onload = function (e) {
		// if ((xhr.readyState === 4) && (xhr.status === 200)) {
			// console.log('Status: ', xhr.status);
			// console.log("Mobile page downloaded. Parse video address...");
			// chrome.webRequest.onBeforeSendHeaders.removeListener(removeHeaderCookie)			
			// var targetVideoURL = findVideoURL(xhr.responseText);
			// console.log("MP4 Address: " + targetVideoURL);
			// downloadVideo({"srcVideo": targetVideoURL})
		// }
	// }

	// xhr.open('GET', refererURL, true);
	// xhr.send(null);
}

function findVideoURL(page){
	console.log(page)
	var parsed = page.replace(/&quot;/g,'"').replace(/\\/g, '').split('"');	
	for(var i in parsed){
		//console.log(parsed[i]);
		if((parsed[i].search("video.twimg.com")>0)&&(parsed[i].search("mp4")>0)){			
			return parsed[i];
		}
	}
}

//chrome.contextMenus.create({"title": "Save as GIF", "contexts":["video"],"onclick": genericOnClick});
chrome.contextMenus.create({"title": "Save this Twitter video", "contexts":["frame"],"onclick": saveVideo});

function getJSONObject(url){	
	var xhr = new XMLHttpRequest();	

	xhr.onload = function (e) {
		var jsonObject = JSON.parse(xhr.response);
		var platlistAddress = jsonObject["track"]["playbackUrl"];
		chrome.storage.sync.get({isVideoSaveAsTS: true}, function(items){
			console.log("Twitter Video save as");			
			console.log("TS", items.isVideoSaveAsTS);
			if(items.isVideoSaveAsTS){
				parsePlaylist(platlistAddress);
			}
		});
	}
	xhr.open('GET', url, true);
	xhr.setRequestHeader("authorization", "Bearer AAAAAAAAAAAAAAAAAAAAAPYXBAAAAAAACLXUNDekMxqa8h%2F40K4moUkGsoc%3DTYfbDKbT3jJPCEVnMYqilB28NHfOPqkca3qaAxGfsyKCs0wRbw");
	xhr.send(null);
	return 	
}

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse){
		console.log(sender.tab ? "from a content script:" + sender.tab.url :"from the extension");
		console.log(request);
		if(request.type == 'simpleVideo'){
			downloadVideo({srcVideo: request.address});
		}else if(request.type == 'gif'){
			genericOnClick({srcUrl: request.address})
		}else if(request.type == 'tsVideo'){
			//console.log(request.id);
			if(request.id){
				var jsonAddress = " https://api.twitter.com/1.1/videos/tweet/config/";
				jsonAddress += request.id+".json";
				console.log(jsonAddress);			
				getJSONObject(jsonAddress);
			}else if(request.playlist){
				parsePlaylist(request.playlist);
			}
		}
		//downloadVideo(request)
	}
);

var removeHeaderCookie = function(info) {
	var headers = info.requestHeaders;

	headers.forEach(function(header, i) {
		if (header.name.toLowerCase() == 'cookie') { 
			console.log('Cookie Delete');
			headers.splice(i)
		}
	}); 
	
	return {requestHeaders: headers};
}

chrome.storage.sync.get({v135: false}, function(items){
	if(!items.v135){
		chrome.storage.sync.set({
			spcificPathName: false,
			isConvertGIF: true,
			isSaveMP4: true,
			isVideoSaveAsTS: true,
			v135: true
		});
		console.log("Version Up");
	}else{
		console.log("Now latest version");
	}
});
