function optionToBooleanGIF(option){
	return ((option == 'gif')||(option == 'both'));
}

function optionToBooleanMP4(option){
	return ((option == 'mp4')||(option == 'both'));
}

function booleansToOption(isConvertGIF,isSaveMP4){
	if (isConvertGIF&&isSaveMP4){
		return 'both'
	}
	else if (isConvertGIF){
		return 'gif'
	}
	else if (isSaveMP4){
		return 'mp4'
	}
}

function saveOptions(){
	var specific = document.getElementById('specific').checked;
	var convertGIF = document.getElementById('gifasgif').checked;
	var saveMP4 = document.getElementById('gifasmp4').checked;
	var saveVideoMP4 = document.getElementById('videoasmp4').checked;
	var saveVideoTS  = document.getElementById('videoasts').checked;
	
	console.log(specific);
	console.log(convertGIF);
	console.log(saveMP4);
	console.log(saveVideoMP4);
	console.log(saveVideoTS);
	
	chrome.storage.sync.set({
		spcificPathName: specific,
		isConvertGIF: convertGIF,
		isSaveMP4: saveMP4,
		isVideoSaveAsMP4: saveVideoMP4,
		isVideoSaveAsTS: saveVideoTS
	},function(){
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function(){
			status.textContent = "";
		},750);
	});
}

function restoreOptions(){	
	chrome.storage.sync.get({
		spcificPathName: false,
		isConvertGIF: true,
		isSaveMP4: false,
		isVideoSaveAsMP4: true,
		isVideoSaveAsTS: true
	}, function(items){
		document.getElementById('specific').checked = items.spcificPathName;
		document.getElementById('gifasgif').checked = items.isConvertGIF;
		document.getElementById('gifasmp4').checked = items.isSaveMP4;
		document.getElementById('videoasmp4').checked = items.isVideoSaveAsMP4;
		document.getElementById('videoasts').checked  = items.isVideoSaveAsTS;

		console.log(items);
	});
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('specific').addEventListener("change", saveOptions);
document.getElementById('gifasgif').addEventListener("change", saveOptions);
document.getElementById('gifasmp4').addEventListener("change", saveOptions);
document.getElementById('videoasmp4').addEventListener("change", saveOptions);
document.getElementById('videoasts').addEventListener("change", saveOptions);