import {onMIDISuccess, onMIDIFailure} from './midi_control.js';

document.addEventListener('DOMContentLoaded', function() {
	const editor = document.getElementById('editor');
	const resizable = document.querySelector('.resizable');
	let isResizing = false;

	let startX, startWidth;

	resizable.addEventListener('mousedown', function(e) {
		 isResizing = true;
		 startX = e.clientX;
		 startWidth = editor.offsetWidth;
		 document.addEventListener('mousemove', handleMouseMove);
		 document.addEventListener('mouseup', stopResize);
	});

	function handleMouseMove(e) {
		 if (!isResizing) return;
		 console.log('starting width: ' + startX)
		 console.log('cur width: ' + e.clientX)

		 // Get computed styles
		 const style = window.getComputedStyle(editor);

		 // Extract padding and margin values
		 const paddingLeft = parseInt(style.paddingLeft, 10);
		 const paddingRight = parseInt(style.paddingRight, 10);
		 const marginLeft = parseInt(style.marginLeft, 10);
		 const marginRight = parseInt(style.marginRight, 10);

		 // Calculate new width
		 let newWidth = startWidth + (e.clientX - startX) - (paddingLeft + paddingRight + marginLeft + marginRight);

		 editor.style.width = `${newWidth}px`;
	}

	function stopResize() {
		 isResizing = false;
		 document.removeEventListener('mousemove', handleMouseMove);
	}
});

//send note offs when tab is closed
addEventListener("unload", (event) => { stopEverything(); });

navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

document.getElementById("reset-button").addEventListener("click", resetCode);

function resetCode(){
   localStorage.removeItem("userCode");
   window.location.reload();

}