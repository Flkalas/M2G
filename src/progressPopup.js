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
		else if (request.greeting == "bye"){
			hideScript();
			sendResponse({farewell: "bye"});
		}
			
});