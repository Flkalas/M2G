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

function findIDnumber(iframeTag){
	var parsed = iframeTag.split(" ");
	for(var i in parsed){
		if(!parsed[i].search("id")){
			return parsed[i].split("=")[1].replace(/['"]+/g, '');
		}
	}
	return false;
}

function findSourceURL(iframeTag){
	var parsed = iframeTag.split('"');
	var stop = false;
	for(var i in parsed){
		if(stop){
			console.log(parsed[i]);
			return parsed[i];
		}
		if(parsed[i].search("src") > 0){
			console.log(parsed[i]);						
			stop = true;
		}
	}
	return false;
}

function isTargetInIframeTags(idTarget,iframeTags){
	for(var i in iframeTags){
		if(iframeTags[i].search(idTarget) > 0){
			console.log(iframeTags[i]);
			return findSourceURL(iframeTags[i]);
		}
	}
	return false;
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
			console.log(request);
			
			var iframeTags = findIframeTag($('body').html().toString());
			for(var i in iframeTags){
				var nowID = findIDnumber(iframeTags[i]);
				if(nowID){
					var subIframeTags = findIframeTag($("#"+nowID).contents().find("body").html());
					var res = isTargetInIframeTags(request.idVideo,subIframeTags);
					if(res){
						console.log(res);
						var req = new XMLHttpRequest();
						req.open('GET', 'src', true);
						req.onreadystatechange = function (aEvt) {
						  if (req.readyState == 4) {
							 if(req.status == 200)
							  console.log(req.responseText);
							 else
							  console.log("Error loading page\n");
						  }
						};
						req.send(null);
					}
				}
			}
			
			
			/*var idTry;
			var parsed = $('body').html().toString().split("<");
			for(var i in parsed){
				if(!parsed[i].search("iframe")){					
					var subParsed = parsed[i].split(" ");
					for(var i in subParsed){
						if(!subParsed[i].search("id")){
							idTry = "#" + subParsed[i].split("=")[1].replace(/['"]+/g, '');
							console.log(idTry);
							console.log($(idTry).contents().find("body").html())
						}
					}
				}
			}*/
		}
});




