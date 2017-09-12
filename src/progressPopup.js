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
			divInject.className = "m2g_ext_container";
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
	console.log("Injected");	
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

function getDownloadAddress(){
	//console.log("click");
	var id = $(this).closest('.tweet').data("tweet-id");
	console.log(id);
		
	var videoTag = $(this).closest('.tweet').find('video')[0];
	if(videoTag){
		videoSource = videoTag.src
		console.log(videoSource);
		if(videoSource.includes('blob')){
			chrome.runtime.sendMessage({type:'tsVideo', id: id});
		}else if(videoSource.includes('ext_tw_video')){
			sendAddress('simpleVideo',videoSource);
		}else{
			sendAddress('gif',videoSource);
		}
	}
}

$( document ).ready(function() {
    console.log("Page ready");
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
