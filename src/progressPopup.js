var alreadyInjected = false;

function injectScript(){
	alreadyInjected = true;
	$(document).ready(	
		function(){
			console.log("wtd");
			var whoBody=document.getElementsByTagName("body")[0];
			console.log(whoBody);

			var imgUrl = chrome.extension.getURL("loading.svg");
			console.log(imgUrl);
			
			var divInject;
			divInject = document.createElement("div");
			divInject.className = "stream-item m2g_ext_container";
			divInject.setAttribute("aria-live","polite");
			divInject.innerHTML='<div class="m2g_ext_spinner"><div class="m2g_spinner"></div></div><div class="m2g_ext_text_box"><p class="m2g_ext_text">GIF Converting...</p></div></div>';
			console.log(divInject);
			
			var maxZ = 0;
			$('div').each(function(){
				var index_current = parseInt($(this).css("z-index"), 10);
				if(index_current > maxZ) {
					maxZ = index_current;
				}
			});
						
			console.log(maxZ);			
			whoBody.appendChild(divInject);
			$(".m2g_ext_container").css('z-index',maxZ+1);
		}
	)
}

function revealScript(){
	$(".m2g_ext_container").removeClass("m2g_hide")
}

function hideScript(){	
	$(".m2g_ext_container").addClass("m2g_hide");	
}

function findIframeTag(strHTML){
	var res = [];
	var parsed = strHTML.split("<");
	for(var i in parsed){
		if(!parsed[i].search("iframe")){
			res.push(parsed[i]);
		}
	}
	return res;	
}

function findExternalIframeContainerDiv(strHTML){
	var res = [];
	var parsed = strHTML.split("<");
	for(var i in parsed){
		if((!parsed[i].search("div"))&&(parsed[i].search("ExternalIframeContainer")>0) ){
			return parsed[i];
		}
	}
	
	return false;
}

function findIDnumber(iframeTag){
	var parsed = iframeTag.split(" ");
	for(var i in parsed){
		if(!parsed[i].search("id")){
			return parsed[i].split("=")[1].replace(/['"]+/g, '');
		}
	}
	return false;
}

function findTargetVmap(tagDiv){
	var rawVmap = tagDiv.substring(tagDiv.search("data-player-config="),tagDiv.length-1).split('"')[1];	
	var rawVmapDecoded = $('<textarea />').html(rawVmap).text().replace(/\\/g, '');
	var vmapURL = rawVmapDecoded.substring(rawVmapDecoded.search('"vmapUrl":'),rawVmapDecoded.length-1).split('"')[3];
	
	return vmapURL;
}

function isTargetInHTML(idTarget,strHTML){
	var posID = String(strHTML).search(idTarget);
	if(posID >= 0){
		return findExternalIframeContainerDiv(strHTML);
	}
	
	return false;
}

function isComplecateVideo(tagDiv){	
	var isVmap = tagDiv.search("vmap") > -1;
	return isVmap;
}

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
				
		console.log(sender.tab ?
			"from a content script:" + sender.tab.url :
			"from the extension");
		if (request.greeting == "hello"){
			if(alreadyInjected){
				revealScript();
				sendResponse({farewell: "already hello"});
			}
			else{
				injectScript();
				sendResponse({farewell: "hello"});
			}
		}
		else if(request.greeting == "bye"){
			hideScript();
			sendResponse({farewell: "bye"});
		}
		else if(request.greeting == "saveVideo"){
			var iframeTags = findIframeTag($('body').html().toString());
			for(var i in iframeTags){
				var nowID = findIDnumber(iframeTags[i]);
				if(nowID){
					var tagDiv = isTargetInHTML(request.idVideo,$("#"+nowID).contents().find("body").html())
										
					if(tagDiv){
						if(isComplecateVideo(tagDiv)){
							console.log("Complecate");
							var vmapURL = findTargetVmap(tagDiv);
							
							$.get(vmapURL, function(responseText) {
								var strResponse = (new XMLSerializer()).serializeToString(responseText);
								var targetVideoSource = strResponse.substring(strResponse.search("http://amp.twimg.com"),strResponse.length-1).split(']')[0];
								console.log(targetVideoSource);
								chrome.runtime.sendMessage({srcVideo: targetVideoSource});
							});
						}
						else{
							console.log("Easy");
							
							var subDivStr= tagDiv.substring(tagDiv.search("video.twimg.com"),tagDiv.length-1).split("&")[0].split("\\");
							var targetVideoSource = "https://";
							for(var i in subDivStr){
								targetVideoSource += subDivStr[i];
							}
							console.log(targetVideoSource);
							chrome.runtime.sendMessage({srcVideo: targetVideoSource});
						}
					}
				}
			}
		}
		else if(request.greeting == "saveMP4Video"){
			//console.log("recv");
			//console.log(document.documentElement.innerHTML)
			url = findVideoURL(document.documentElement.innerHTML)
			console.log(url)
			chrome.runtime.sendMessage({srcVideo: url});
		}
});

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

var downloadButton = '<div class="ProfileTweet-action m2g_download_action"><button class="ProfileTweet-actionButton u-textUserColorHover js-actionButton m2g_js_download" type="button"><div class="IconContainer js-tooltip" data-original-title="Video Download"><span class="Icon Icon--medium m2g_download_icon"></span><span class="u-hiddenVisually"></span></div></button></div>';

function injectButtons(){	
	// console.log("Injected");	
	$(".tweet").each(function(index){
		var videoTag = $(this).find('.AdaptiveMedia-video')[0];		
		if(videoTag){
			console.log('Finded video Tweet. Add button.');
			$(this).find('div.ProfileTweet-action--favorite').after(downloadButton);
		}
		
	});
	//$(downloadButton).insertAfter(".ProfileTweet-action--favorite");
}

function sendAddress(type,address){
	chrome.runtime.sendMessage({type:type, address: address});
}

function getCookies(domain, name, callback) {
	chrome.cookies.get({"url": domain, "name": name}, function(cookie) {
		if(callback) {
			callback(cookie.value);
		}
	});
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function findVideoURL(page){
	var parsed = page.replace(/&quot;/g,'"').replace(/\\/g, '').split('"');	
	for(var i in parsed){
		if((parsed[i].search("video.twimg.com")>0)&&(parsed[i].search("mp4")>0)){			
			return parsed[i];
		}
	}
}

function downloadMobileMP4(targetURL){
	var xhr = new XMLHttpRequest();
	xhr.onload = function (e) {
		if ((xhr.readyState === 4) && (xhr.status === 200)) {
			console.log('Status:', xhr.status);
			console.log("Mobile page downloaded. Parse video address...");
			var targetVideoURL = findVideoURL(xhr.responseText);
			console.log("MP4 Address: " + targetVideoURL);
			chrome.runtime.sendMessage({type:'mp4Video', address: targetVideoURL});
		}
	}
	xhr.open('GET', targetURL, true);

	xhr.setRequestHeader("authorization", "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA");
	xhr.setRequestHeader("x-csrf-token", getCookie("ct0"));

	xhr.send(null);
	return
}

function getJSONObject(url){	
	var xhr = new XMLHttpRequest();	

	xhr.onload = function (e) {
		var jsonObject = JSON.parse(xhr.response);
		var platlistAddress = jsonObject["track"]["playbackUrl"];
		chrome.runtime.sendMessage({type:'tsVideo', playlist: platlistAddress});
	}
	xhr.open('GET', url, true);

	xhr.setRequestHeader("authorization", "Bearer AAAAAAAAAAAAAAAAAAAAAPYXBAAAAAAACLXUNDekMxqa8h%2F40K4moUkGsoc%3DTYfbDKbT3jJPCEVnMYqilB28NHfOPqkca3qaAxGfsyKCs0wRbw");
	xhr.setRequestHeader("x-csrf-token", getCookie("ct0"));

	xhr.send(null);
	return 	
}

function getDownloadAddress(){
	//console.log("click");
	var id = $(this).closest('.tweet').data("tweet-id");
	console.log(id);
		
	var videoTag = $(this).closest('.tweet').find('video')[0];
	if(videoTag){
		videoSource = videoTag.src
		if(!videoSource){
			videoSource = $(this).closest('.tweet').find('source')[0].src
		}
		console.log(videoSource);
		if(videoSource.includes('blob')){
			chrome.storage.sync.get({isVideoSaveAsTS: true, isVideoSaveAsMP4: true}, function(items){
				console.log("Twitter Video save as");			
				console.log("TS", items.isVideoSaveAsTS);
				console.log("MP4", items.isVideoSaveAsMP4);
				if(items.isVideoSaveAsTS){
					var jsonAddress = "https://api.twitter.com/1.1/videos/tweet/config/";
					jsonAddress += id+".json";
					console.log(jsonAddress);			
					getJSONObject(jsonAddress);
				}
				if(items.isVideoSaveAsMP4){
					var pageAddress = "https://api.twitter.com/1.1/statuses/show.json?include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_reply_count=1&tweet_mode=extended&trim_user=false&include_ext_media_color=true&id=";
					pageAddress += id;
					console.log(pageAddress);			
					downloadMobileMP4(pageAddress);
				}
			});
			
		}else if(videoSource.includes('ext_tw_video')){
			sendAddress('simpleVideo',videoSource);
		}else{
			sendAddress('gif',videoSource);
		}
	}
}

$( document ).ready(function() {
    // console.log("Page ready");
	injectButtons();
	connectClickListener();
});

function connectClickListener(){
	var classname = document.getElementsByClassName("m2g_js_download");
	for (var i = 0; i < classname.length; i++) {
		classname[i].addEventListener('click', getDownloadAddress, false);
	}
}

$(document).on('DOMNodeInserted', function(e) {
    if ($(e.target).find('.AdaptiveMedia-video')[0]){
		//console.log(e.target);
		if($(e.target).find('button.m2g_js_download')[0]){
			console.log("Already added? no action");
		}else{
			var video = $(e.target).find('.AdaptiveMedia-video').each(function(index){
				var tweet = $(this).closest('.tweet');
				console.log(tweet);
				if($(tweet).find('button.m2g_js_download')[0]){
					console.log("Already added? no action");
				}
				else{					
					var favIcon = $(tweet).find('div.ProfileTweet-action--favorite')[0];
					//console.log(favIcon);
					$(favIcon).after(downloadButton);					
					console.log("Added video Tweet. Also add button.");
				}
			});
			
			$(e.target).find('button.m2g_js_download').each(function(index) {
				$(this).on("click", getDownloadAddress);
			});
		}
    }
});
