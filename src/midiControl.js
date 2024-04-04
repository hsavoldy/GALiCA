import {initializeCodeBox, midiClock, onClock, globalClock, setupClock} from './main.js';
import {Seq, seqs_dict} from './seqControl.js';
import { makingIf, createTernStatement } from './algorithmControl.js';

export var midi = null;
export var muted = false;

export var beat = 0;

export var outputMidiID = null;
export var outputMidiID2 = null;

export var midiMsgs = {};
export var ccCallbacks = {};

export function onMIDISuccess(midiAccess) {
	console.log("MIDI ready!");
	midi = midiAccess;  // store in the global
	Tone.Transport.start()

	initializeCodeBox();
	setupClock();
	initializeGlobalVariables();
}

function initializeGlobalVariables(){
	for(let i=0;i<128;i++){
		eval('globalThis.CC'+i+'='+0+';');
		eval('globalThis.CC'+i+'_func = function(){return CC' +i+ '}');
	}
	globalThis.CC = new Array(128).fill(0)
	globalThis.midiOn_func = function(x){return x}
	globalThis.midiOff_func = function(x){return x}
}

export function onMIDIFailure(msg) {
	console.error(`Failed to get MIDI access - ${msg}`);
}

export var midi_input_ids = {};
export var midi_output_ids = {};
export var midi_input_names = {};
export var midi_output_names = {};

export function getMidiIO(){
	var midiInputs = 'MIDI Inputs:\n';
	var midiOutputs = 'MIDI Outputs:\n';
	var inputID = null;
	var outputID = null;

	var num = 1;
	for (var output of midi.outputs) {
		midiOutputs += num + ': ' + output[1].name + '\n'; //+ '\', ID: \'' + output[1].id + '\'\n';
		outputID = output[1].id;
		midi_output_ids[num] = outputID;
		midi_output_names[num] = output[1].name;
		num += 1;
	}

	num = 1;
	for (var input of midi.inputs) {
		midiInputs += num + ': ' + input[1].name + '\n'; // + '\', ID: \'' + input[1].id + '\'\n';
		inputID = input[1].id;
		midi_input_ids[num] = inputID;
		midi_input_names[num] = input[1].name;
		num += 1;
	}
	return midiInputs + midiOutputs
}

export function setMidiInput(inputID) {
	//in case only one id is inputted, turn into array
	if (!Array.isArray(inputID)) {
		inputID = [inputID];
	}

	//reset inputs
	midi.inputs.forEach(function (key, val) {
		// console.log(key)
		key.onmidimessage = null;
	})

	for (var id of inputID) {
		if (id in midi_input_ids & midi.inputs.get(midi_input_ids[id]) != null) {
			midi.inputs.get(midi_input_ids[id]).onmidimessage = handleMidiInput;
			console.log("MIDI input set to: " + midi_input_names[id]);
		} else {
			console.warn('Invalid input ID');
		}
	}
}
export function setMidiOutput(outputID) {
	if (Array.isArray(outputID)) {
		console.warn('Can only handle one MIDI output. Please enter one ID.')
	}
	if (outputID in midi_output_ids & midi.outputs.get(midi_output_ids[outputID]) != null) {
		outputMidiID = midi_output_ids[outputID];
		console.log("MIDI output set to: " + midi_output_names[outputID]);
	} else {
		console.warn('Invalid output ID');
	}
}

//for second midi output device
export function setMidiOutput2(outputID) {
	if (Array.isArray(outputID)) {
		console.warn('Can only handle one MIDI output. Please enter one ID.')
	}
	if (outputID in midi_output_ids & midi.outputs.get(midi_output_ids[outputID]) != null) {
		outputMidiID2 = midi_output_ids[outputID];
		console.log("MIDI output 2 set to: " + midi_output_names[outputID]);
	} else {
		console.warn('Invalid output ID');
	}
}

export function handleMidiInput(message) {
	// console.log(message);
	if (message.data[1] != null) {
		let msg_type = 'note';
		if((message.data[0]>>4)==11)msg_type = 'cc';
		// if(msg_type='cc'){
		// 	console.log(msg_type, message.data[1], message.data[2]);

		// }
		//could parse notes to output pitches, e.g. C4 etc.
		//could parse CCs to look for mod wheel, pitch bend, etc.
		// updateStatusBar(['midi_input', msg_type, message.data[1], message.data[2]]);
		//document.getElementById("lastMidi").innerHTML = [message.data[0], message.data[1], message.data[2]];
		if(msg_type === 'cc') document.getElementById("midiInMonitor").innerHTML = [msg_type + message.data[1], message.data[2], message.data[0]&15];
		else document.getElementById("midiInMonitor").innerHTML = [message.data[1], message.data[2], message.data[0]&15];
	}
	if (midiClock) {
		getMIDIClock(message);
	}
	if (makingIf) {
		if (message.data[2] > 0) { //only respond to note on messages
			createTernStatement(message.data);
		}
	} else {
		midiReset(message);
		handleNote(message);
		handleCC(message);
	}
}

function midiReset(message) {
	var command = message.data[0];
	if (command == 250) {
		console.log("midi start");
		reset();
	} else if (command == 255) {
		console.log("midi reset");
		reset();
	}

}


function getMIDIClock(message) {
	var command = message.data[0];
	if (command == 248) {
		onClock();
	}
	if (globalClock % 24 == 0) {
		beat += 1;
	}

}

function handleCC(message){
	var command = message.data[0];
	var channel = message.data[0]>>4
	var note = message.data[1];
	var value = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command
	if (command >= 176 & command <= 191) { //may be higher than 176 depending on channel number
		//console.log(channel,note,value)
		midiMsgs[note] = value;
		eval('globalThis.CC'+note+'='+value+';');
		try{ globalThis.CC[note] = value} catch(e){console.log(e)}
		try{
			// console.log('CC'+note+'_func');
			eval('globalThis.CC'+note+'_func')();
		}catch{"error with CC func"}
		try{
			eval('globalThis.CC'+note+'_alg')();
		}catch{}
		sendCC(note, value, channel)
	}

}

function handleNote(message) {
	var command = message.data[0];
	var note = message.data[1];
	var velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command
	if (command >= 144 & command <= 159) { //note on- may be higher than 144 depending on channel number
		midiMsgs[note] = velocity;		
		try{
			eval('midi'+note%12+'_func')(note,velocity);
		}catch{}
		for (var key in seqs_dict) {
			var seq = seqs_dict[key];
			if (seq.repopulating) {
				seq.newVals.push(note);
			}
			if (seq.inserting) {
				seq.vals.push(note);
			}

		}
		try{midiOn_func(note)}catch{}
	}else if(command >= 128 & command <=143){ //note off
		midiMsgs[note] = null;
		try{midiOff_func(note)}catch{}
	}
}

export function midiMap(num) {
	mapping = [0x90, num];
	muted = true;
}

export function ccMap(num) {
	mapping = [0xB0, num];
	muted = true;
}

export function stopMap() {
	//stop last message just in case
	const noteOffMessage = [0x80, mapping[1], 0];    // 0x80 note off + channel, midi pitch num, velocity
	var output = midi.outputs.get(outputMidiID);
	output.send(noteOffMessage);

	mapping = false;
	muted = false;
}


export function mute() {
	muted = true;
}

export function unmute() {
	muted = false;
}

export function toggleMute() {
	muted = !muted;
}

export function sendCC(num, val, channel){
	const ccMessage = [0xB0 + channel - 1, num, val];    // 0xB0 CC + channel, controller number, data

	var output = midi.outputs.get(outputMidiID);
	output.send(ccMessage);
}

export function sendNote2(num, val, channel){
	const msg = [144 + channel - 1, num, val];    // 0xB0 CC + channel, controller number, data
	console.log('sendNote2 ', num, val, channel)
	var output = midi.outputs.get(outputMidiID2);
	output.send(msg);
}
