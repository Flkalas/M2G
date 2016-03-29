
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
	var gifSaveAs = document.getElementById('gifSaveAs').value;
	var convertGIF = optionToBooleanGIF(gifSaveAs);
	var saveMP4 = optionToBooleanMP4(gifSaveAs);
		
	console.log(specific);
	console.log(gifSaveAs);
	console.log(convertGIF);
	console.log(saveMP4);
	
	chrome.storage.sync.set({
		spcificPathName: specific,
		isConvertGIF: convertGIF,
		isSaveMP4: saveMP4
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
		spcificPathName: false,
		isConvertGIF: true,
		isSaveMP4: false
	}, function(items){
		document.getElementById('specific').checked = items.spcificPathName
		document.getElementById('gifSaveAs').value = booleansToOption(items.isConvertGIF,items.isSaveMP4);
		
		console.log(items);
	});
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('specific').addEventListener("change", saveOptions);
document.getElementById('gifSaveAs').addEventListener("change", saveOptions);