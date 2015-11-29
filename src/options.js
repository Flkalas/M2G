function saveOptions(){
	var specific = document.getElementById('specific').checked;
	console.log(specific);
	chrome.storage.sync.set({
		spcificPathName: specific
	},function(){
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function(){
			status.textContent = '\b';
		},750);
	});
}

function restoreOptions(){	
	chrome.storage.sync.get({
		spcificPathName: false
	}, function(items){
		document.getElementById('specific').checked = items.spcificPathName
		console.log(items.spcificPathName);
	});
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('specific').addEventListener("change", saveOptions);