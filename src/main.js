import {
	midi, onMIDISuccess, onMIDIFailure, setMidiInput, setMidiOutput, getMidiIO,
	handleMidiInput, outputMidiID, midiMap, ccMap, stopMap, mute, muted, toggleMute
} from "./midiControl.js";
import { Seq, seqs_dict, checkSeqs, _, stopEverything, reset } from './seqControl.js'
import { makingIf, startTern, addToAlgs, assignAlg } from "./algorithmControl.js";
import { createStarterText, starterCode } from "./starterCode.js"
import { floor, ceil, peak, cos, sin, round, trunc, abs } from './midiMath.js';
import{ updateDisplay, display } from './display.js'

//http-server -o index.html -p 8000
export let globalClock = 0;
export var beatsPerMeasure = 4;
export var midiClock = false;
export var tempo = 110;
export var mapping = false;
export var major = [60, 62, 64, 65, 67, 69, 71];
export var minor = [60, 62, 63, 65, 67, 68, 70];
export var scale = major; //and minor, can add other modes too 
export var algs = [];
export var alg_names = {};
export var clockWorker = null;

var seqs = []
export var seqsToStart = {}


/************************************
 * 
 * USER FUNCTIONS
 * 
 * ************************************/

/**
* Change the scale type for all sequencers
* @param {number[]} newScale - major or minor
*/
export function setScale(newScale) {
	scale = newScale;
}

/**
* To begin sending repeated MIDI messages for external mapping
* @param {number|boolean} val - The value of the desired mapping, or false to stop mapping
* @param {string} type - 'midi' to send MIDI messages or 'cc' to send CC messages
*/
export function map(val, type) {
	if (val === false) {
		mapping = false;
	} else {
		mapping = [type === 'midi' ? 0x90 : 0xB0, val];
	}
}

/**
* Set new tempo
* @param {number} tempo - new tempo in bpm
*/
function changeTempo(tempo) {
	var interval = 1 / (tempo / 60) * 1000 / 24;
	clockWorker.postMessage({ type: 'changeInterval', interval: interval });
}

function changeRow(row) {
	beatsPerMeasure = row;
	console.log('beats per measure: ' + beatsPerMeasure);
}

function panic(){
	for(let i=0;i<16;i++){
		for(let j=0;j<128;j++) {
			var channel = i+1;
			const noteOffMessage = [0x80 + channel - 1, j, 0];    // 0x80 note off + channel, midi pitch num, velocity
			var output = midi.outputs.get(outputMidiID);
			output.send(noteOffMessage);
		}
	}
}

export function resetClock(){
	globalClock = 0
}

/**
* Change whether clock is internal or from incoming MIDI clock messages
* @param {boolean} useMidiCLock - true to use MIDI clock, false to use internal clock
*/
export function setMidiClock(useMidiCLock) {
	midiClock = useMidiCLock;
	setupClock();
}

/************************************
 * 
 * CLOCKING
 * 
 * ************************************/
export function setupClock() {
	if (window.Worker) {
		clockWorker = new Worker('./src/clockWorker.js');

		clockWorker.onmessage = (event) => {
			if (!midiClock) {
				onClock();
			}
		};

		clockWorker.postMessage({ type: 'start', interval: 1 / (tempo / 60) * 1000 / 24 });
	} else {
		// Fallback for browsers that don't support Web Workers
		console.warn("browser doesn't support internal clock");
	}
}

//execute on every incoming tick from midi clock
//24 ppqn
export function onClock() {
	//start new seqs
	if (globalClock % (24 * beatsPerMeasure) == 0) {
		for (var key in seqsToStart) {
			if (key in seqs_dict) {
				seqs_dict[key].stop();
			}
			seqs_dict[key] = seqsToStart[key];
			seqs_dict[key].name = key;
			seqs_dict[key].start();
		}
		seqsToStart = {};
	}
	globalClock += 1;
	checkSeqs();
	if (mapping != false & globalClock % 10 == 0) {
		console.log('sending');
		const message = [mapping[0], mapping[1], 1];    // 0x80 note off + channel, midi pitch num, velocity
		var output = midi.outputs.get(outputMidiID);
		output.send(message);
	}
}

/************************************
 * 
 * PARSING
 * 
 * ************************************/

function checkStringForNonVariable(str) {
	for (var i = 0; i < str.length; i++) {
		if (str[i] == '(') return true;
		else if (str[i] == '{') return true;
		else if (str[i] == '\t') return true;
		else if (str[i] == '=') return false;
	}
	return false;
}

function isNumber(str) {
	return !isNaN(parseInt(str));
}

//replaces all arrays with 0 for regex parsing
function removeArray(str) {
	while (str.includes('[')) {
		str = str.slice(0, str.indexOf('[')) + '0' + str.slice(str.indexOf(']') + 1);
	}
	return str;
}

/************************************
 * RUN CODE
 * - main code parser for codemirror
 * ************************************/
var editor = null;
function runCode(code) {
	//alt-x (≈)	generates a musical tie, like _ generates a rest
	//switched to __ ( 2 UNDERSCORES)
	//switched to ^ :-)
	code = code.replace("^", -87654321);
	for (let name in alg_names) {
		var exp = new RegExp(`(?<![a-zA-Z]|')${name}(?![a-zA-Z]|')`, 'g');
		code = code.replaceAll(exp, (algs[alg_names[name]])); //replaceAll(name + ' ', eval(alg_names[name]) + ' ');
	}

	var lines = code.split('\n');
	code = '';

	var seqArrays = {}; //to store the names of each seq's named arrays

	for (var line of lines) {
		if (line[0] === ';') { //sometimes codeMirror begins a line with a semicolon which we need to avoid here
			line = line.slice(1);
		}

		//ignore lines that start with comments
		if (line[0] === '/' && line[1] === '/') line = '\t'

		//add 'globalThis.' to every variable to ensure that they are globally scoped in node
		//add global.this to all variable definitions
		if (checkStringForNonVariable(line)) {//true if there is '(' before '='
			//e.g.'not a variable'
			code += line;
		}
		else if (line.match(/\s*(\w+)\s*=\s*([^;]+)/)) { //is a variable definition, add globalThis
			code += 'globalThis.' + line;
		} else { //not a variable declaration- just add it
			code += line;
		}

		//check for named inputs to Seq so we can let them be redefined
		//this lets us pass an array to Seq and updates to the array are
		//passed through to the seq
		var inputs = removeArray(line).replace('/', '').match(/(\w+)\s*=\s*new\s+Seq\((\w+),?\s*(\w+)?,?\s*\d*\)/);
		//console.log(inputs)
		if (inputs) {
			//console.log(inputs)
			var seqName = inputs[1];
			var notes = isNumber(inputs[2]) ? null : inputs[2]; //set to null if notes is a number (at this point, arrays have been converted to numbers)
			var durs = isNumber(inputs[3]) ? null : inputs[3];
			//console.log('seqArrays', seqName, notes, durs)
			seqArrays[seqName] = [notes, durs];
		}
		code += ';';  //enable multiple lines to execute at once
	}
	//if the code contains a "startTern", we just want to start the algorithm. Don't execute the code.
	if (code.indexOf('startTern') !== -1) {
		startTern();
		return;
	}

	eval(code);

	var assignments = code.match(/(globalThis\.\s+(\w+)\s*=\s*([^;]+))|(globalThis\.(\w+)\s*=\s*([^;]+))/g);
	if (assignments) {
		for (var i = 0; i < assignments.length; i++) {
			var assignment = assignments[i].match(/globalThis\.\s*(\w+)\s*=\s*([^;]+)/);
			if (assignment) {
				var variableName = assignment[1];
				window[variableName] = eval(assignment[1]);
				//if it's a sequencer, add to list
				if (eval(variableName) instanceof Seq) {
					//console.log(seqsToStart, variableName, seqArrays)
					seqsToStart[variableName] = eval(variableName);
					eval(variableName).valsName = seqArrays[variableName][0];
					eval(variableName).dursName = seqArrays[variableName][1];
				}
			}
		}
	}
}

function evaluateBlock() {
	try {
		var positions = [];
		let linepos = editor.getCursor().line;
		var line = editor.getLine(linepos);
		while (line.replace(/\s/g, "") != '') {
			positions.push(linepos);
			linepos = linepos - 1;
			line = editor.getLine(linepos);
			if (line == undefined) {
				break;
			}
		}
		linepos = editor.getCursor().line + 1
		line = editor.getLine(linepos)
		if (line != undefined) {
			while (line.replace(/\s/g, "") != '') {
				positions.push(linepos);
				linepos = linepos + 1;
				line = editor.getLine(linepos);
				if (line == undefined) {
					break;
				}
			}
		}
		positions.sort();
		var codeToRun = ';'
		for (var position of positions) {
			codeToRun += editor.getLine(position) + '\n';
		}
		runCode(codeToRun);
	} catch (e) {
		console.error(e);
	}

}

function evaluateLine() {
	try {
		let pos = editor.getCursor()
		var line = editor.getLine(pos.line)
		runCode(line);
	} catch (e) {
		console.error(e);
	}

}

function evaluateCode() {
	var code = editor.getValue();
	try {
		runCode(code);
	} catch (e) {
		console.error(e);
	}
}

/************************************
 * 
 * INITIALIZE CODEBOX
 * 
 * ************************************/
export var editor = null;
export function initializeCodeBox() {
	let starterText = createStarterText(getMidiIO());

	editor = CodeMirror(document.getElementById("editor"), {
		extraKeys: {
			'Ctrl-Enter': evaluateLine,
			//'Shift-Enter': evaluateCode,
			'Ctrl-.': stopEverything,
			'Alt-Enter': evaluateBlock
		},
		//value: instructions + '\n' + midiInputs + '\n' + midiOutputs + '\n' + midiCodeExample + '\n\na = new Seq([1,3,2,4]);\n',
		value: starterText,
		mode: "javascript",
		lineNumbers: true
	});
	editor.setSize()
	editor.on("change", function (instance, changeObj) {
		// CodeMirror content has changed, update the cached code
		updateCachedCode(instance.getValue());
	});
} //initialize codebox



function updateCachedCode(code) {
	// Use localStorage or sessionStorage to store the code
	localStorage.setItem("userCode", code);
}

//add stringToAdd to the end of the codebox
export function addToEditor(stringToAdd) {
	var lineCount = editor.lineCount(); // Get the total number of lines
	var lastLine = editor.getLine(lineCount - 1); // Get the content of the last line
	var lastLineEnd = editor.posFromIndex(editor.indexFromPos({ line: lineCount - 1, ch: 0 })) + lastLine.length; // Calculate the end position of the last line

	var newLineContent = stringToAdd; // The content of the new line

	// Add the new line at the end
	editor.replaceRange("\n" + newLineContent, editor.posFromIndex(lastLineEnd));

	// Update line numbers
	editor.refresh();
}

//replace the last line with stringToReplace
export function replaceLastLine(stringToReplace) {
	var lineCount = editor.lineCount(); // Get the total number of lines
	var lastLine = lineCount - 1; // Index of the last line
	var lastLineText = editor.getLine(lastLine); // Get the content of the last line
	var lastLineStart = { line: lastLine, ch: 0 }; // Start position of the last line
	var lastLineEnd = { line: lastLine, ch: lastLineText.length }; // End position of the last line

	// Replace the entire contents of the last line with the new content
	editor.replaceRange(stringToReplace, lastLineStart, lastLineEnd);

	// Update line numbers
	editor.refresh();
}

//Search for stringToReplace in the codebox and replace the last instance of it with newString
export function replaceString(stringToReplace, newString) {
	var cursor = editor.getSearchCursor(stringToReplace);
	var lineNumber = -1;

	while (cursor.findNext()) {
		lineNumber = cursor.from().line;
	}

	if (lineNumber === -1) {
		console.warn("couldn't find string");
		return;
	}

	var lineText = editor.getLine(lineNumber); // Get the content of the line
	var startOfString = lineText.lastIndexOf(stringToReplace);
	var lineStart = { line: lineNumber, ch: startOfString }; // Start position of the last line
	var lineEnd = { line: lineNumber, ch: startOfString + stringToReplace.length }; // End position of the last line
	// Replace the entire contents of the last line with the new content
	editor.replaceRange(newString, lineStart, lineEnd);

	// Update line numbers
	editor.refresh();
}

export function freezeEditor() {
	editor.setOption("readOnly", "nocursor");
}

export function unfreezeEditor() {
	editor.setOption("readOnly", false);
}

export function clearCachedCode() {
	localStorage.removeItem("userCode");
}