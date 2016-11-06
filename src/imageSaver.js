var itemID;
var waitComplete;

function closeSelf(){
	
	chrome.downloads.search({id: itemID}, function(resultItem){
		console.log(resultItem[0]);
		if(resultItem[0].state == "complete"){
			console.log("Download Complete.");
			clearInterval(waitComplete);
			chrome.tabs.getCurrent(function (tabNow){
				chrome.tabs.remove(tabNow.id);
			});			
		}
	});	
}

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		console.log(sender.tab ?
			"from a content script:" + sender.tab.url :
			"from the extension");
		if (request.greeting == "sendImage"){
			//var repreData = "data:image/gif;base64," + request.dataImage;
			//console.log(repreData);
			
			var u8Array = new Uint8Array(atob(request.dataImage).split("").map(function(c){return c.charCodeAt(0); }));
			//var blob = new Blob([u8Array]);
			var blob = new Blob([u8Array],{type:'image/gif'});
			var url = URL.createObjectURL(blob);
			document.getElementById('imageresult').src = url;
			console.log(url);
			
			chrome.downloads.download({url: url, filename: request.nameOrgin+".gif", saveAs: true},function(id){
				waitComplete = setInterval(closeSelf, 300);
				itemID = id;
			});
		}
});

chrome.runtime.sendMessage({greeting: "reqImage"});