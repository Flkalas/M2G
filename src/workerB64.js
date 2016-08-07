importScripts('jsgif/b64.js');

self.addEventListener('message', function(e) {
	if(e.data.string !== undefined){
		var data = encode64(e.data.string);
		self.postMessage(data);
	}
}, false);

