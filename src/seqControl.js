 import { globalClock, resetClock, major, minor, scale, beatsPerMeasure, seqsToStart } from './main.js';
import { muted, midi, outputMidiID, beat } from './midiControl.js';
import { floor,ceil,peak,round,trunc,abs,cos,random} from './midiMath.js'
import{ textSources, textHeaders, updateDisplay, display, curDisplaySource } from './display.js'


export var bar = 0;
var column = [4];
var divID = 'display-box';
var seqs_dict = {};
export var _ = -999999999;

export function checkSeqs() {
	for (var key in seqs_dict) {
		var seq = seqs_dict[key];
		if (seq.timeForNext()) {
			seq.executeStep();
		}
		if (seq.restarted) {
			seqsToStart[key] = seq;
			seq.restarted = false;
		}
	}
}

export function reset() {
	for (var key in seqs_dict) {
		seqs_dict[key].reset();
	}
	resetClock() //must update globalclock in main.js?
	//globalClock = 0;
}

function checkChannel(channel) {
	if (channel > 16) {
		console.warn("Available MIDI Channels are 1-16. Using channel 1.");
		channel = 1;
	} else if (channel <= 0) {
		channel = 1;
	}
	return channel
}

export function stopEverything() {
	for (let key in seqs_dict) {
		seqs_dict[key].stop();
	}
	seqs_dict = {};
}

export var seqs_dict = {};

export class Seq {
	constructor(vals, durs = 1 / 4, channel = 0) {
		this.vals = vals;
		this.durs = durs;
		this.index = 0;
		this.valsInd = 0;
		this.dursInd = 0;
		this.noteInc = 1;
		this.dursInc = 1;
		this.repopulating = false;
		this.inserting = false;
		this.stopped = false;
		this.nextValTime = globalClock
		this.channel = channel;
		this.velocity = 127;
		this.controllerNum = 7; //volume
		this.restarted = false;
		this.monitor = false;
		this.newVals = [];
		this.lastNoteSent = -1;
		if (channel > 16) {
			console.warn("Cannot have a channel larger than 16. Setting channel to 1.");
			this.channel = 1;
		}
		this.stepFunc = this.sendNote;
		this.name = '';
		this.octave = 0;
		this.valsName = null;
		this.dursName = null;
	}

	executeStep() {
		this.updateArrays();
		this.advanceStep();
		this.callback();
		this.stepFunc();
		this.updateDisplay();
	}

	advanceStep() {
		this.curVal = this.nextVal();

		//apply transform
		this.curVal = this.transform(this.curVal);

		if (this.curVal == null) { return; }
		if (muted) { return; }

		this.channel = checkChannel(this.channel);
	}

	sendNoteOff(noteNum) {
		if (noteNum == null | noteNum < 0) {
			return;
		}
		var channel = checkChannel(this.channel);
		const noteOffMessage = [0x80 + channel - 1, noteNum, 0];    // 0x80 note off + channel, midi pitch num, velocity
		var output = midi.outputs.get(outputMidiID);
		output.send(noteOffMessage);
	}

	//called for every note right before execution
	transform(x) {
		return x;
	}

	sendNote() {
		var noteArray = Array.isArray(this.curVal) ? this.curVal : [this.curVal];
		let i=0
		let prevNotes = this.lastNoteSent
		this.lastNoteSent = []

		//console.log(noteArray, '\n', prevNotes)

		for(i=0;i<noteArray.length;i++){
			var noteNum = noteArray[i]
		
			// var isArray = Array.isArray(noteNum) //support arrays of numbers
			// var prevIsArray = Array.isArray(this.lastNoteSent)

			//look for ties, e.g. -87654321
			if (noteNum > -900000000 && noteNum < -7000000 && !isArray) return;

			//look for existing active note to send noteoff
			if( prevNotes[0] !== -1){
				for(let j=0;j< prevNotes.length ;j++){
					this.sendNoteOff(prevNotes[j], this.channel);
					if (this.monitor) console.log(this.name + ' noteoff: ' + prevNotes[j]);
				}
			}

			//calculate new midi note based on scale degree and scale
			var midiNote;
			if (scale != null) {
				var accidental = false;
				var adjustedNoteNum = noteNum;
				if (noteNum * 10 % 10 != 0) { //is there a decimal?
					adjustedNoteNum = Math.floor(Math.abs(noteNum)) * noteNum / Math.abs(noteNum); //make positive for floor then add back sign
					accidental = true;
				}
				midiNote = scale.slice(adjustedNoteNum % scale.length)[0] + Math.floor(adjustedNoteNum / scale.length) * 12 + (this.octave * 12);

				//increase MIDI note by one if there was a decimal
				if (accidental) {
					if (noteNum > 0) {
						midiNote += 1;
					} else {
						midiNote -= 1;
					}
				}
			}
			else {
				midiNote = noteNum;
			}

			//look for rests
			if (midiNote < 0 || midiNote == null || midiNote > 127) { 
				this.lastNoteSent[0] = -1;
				return; 
			}

			//send MIDI msg
			const noteOnMessage = [0x90 + this.channel - 1, midiNote, this.velocity];    // 0x90 note on + channel, midi pitch num, velocity
			var output = midi.outputs.get(outputMidiID);
			output.send(noteOnMessage);
			document.getElementById("midiOutMonitor").innerHTML = [midiNote, this.velocity, this.channel];

			this.lastNoteSent.push( midiNote )
		}//for loop

		//for console logging
		if (this.monitor) console.log(this.name + ' midi: ' + midiNote, ' vel: ' + this.velocity);
	}//sendNote

	sendCC() {
		const ccMessage = [0xB0 + this.channel - 1, this.controllerNum, this.curVal];    // 0xB0 CC + channel, controller number, data

		var output = midi.outputs.get(outputMidiID);
		output.send(ccMessage);
		console.log(ccMessage);
	}

	timeForNext() {
		if (this.stopped) {
			return false;
		}
		if (this.nextValTime <= globalClock) {
			return true;
		} else {
			return false;
		}
	}

	nextVal() {
		if (this.vals.length === 0) {
			this.valsInd = 0;
			this.index = 0;
			return null;
		}

		//update index
		this.valsInd = this.updateIndex(this.valsInd) % this.vals.length

		var note = this.vals[Math.floor(this.valsInd >= 0 ? this.valsInd : (this.vals.length - this.valsInd))];

		//handle out of bounds
		var sign = this.valsInd != 0 ? Math.round(this.valsInd / Math.abs(this.valsInd)) : 1;
		this.valsInd = this.valsInd * sign;
		this.valsInd = Math.round(((this.valsInd) % this.vals.length) * sign);
		this.index = this.valsInd;''

		var nextStep = null;
		//take care of incrementing duration index in case where durs is an array
		if (Array.isArray(this.durs)) {
			this.updateDurIndex();
			nextStep = this.durs[floor(this.dursInd)];
		} else{
			nextStep = this.durs;
		}
		this.nextValTime = globalClock + nextStep * 24 * 4;
		
		return note
	}

	updateIndex(index) { 
		return (index + this.noteInc);
	}

	updateDurIndex() { this.dursInd = (this.dursInd + this.dursInc) % this.durs.length }

	repopulate() {
		this.newVals = [];
		this.repopulating = true;
	}

	stopPop() {
		if (this.valsInd >= this.newVals.length) {
			this.valsInd = this.newVals.length - 1;
			this.index = this.valsInd;
		}
		this.vals = this.newVals;
		this.repopulating = false;
	}

	appendNote(note) {
		this.vals.push(note);
	}

	stop() {
		this.stopped = true;
		this.sendNoteOff(this.lastNoteSent, this.channel);
	}

	panic(){
		for( let i=0;i<127;i++ ) this.sendNoteOff(i, this.channel);
	}

	start() {
		this.stopped = false;
	}

	reset() {
		this.valsInd = 0;
		this.index = 0;
		this.dursInd = 0;
		this.nextValTime = 0;
		this.sendNoteOff(this.lastNoteSent, this.channel);
		this.restarted = true;
		this.stop();
	}

	callback() {
		//console.log('here');
		return;
	}

	//keep track of global arrays accessed by seq
	updateArrays() {
		if (this.valsName) {
			var newVals = eval('globalThis.' + this.valsName);
			this.valsInd = this.valsInd % newVals.length;
			this.index = this.valsInd;
			this.vals = newVals;
		}
		if (this.dursName) {
			var newDurs = eval('globalThis.' + this.dursName);
			if (Array.isArray(newDurs)) {
				this.dursInd = this.dursInd % newDurs.length;
			}
			this.durs = newDurs;
		}
		if( !Array.isArray(this.vals)) this.vals = [this.vals]
	}

	updateDisplay(){
		  const rows = [];
		  const numCols = 8;
		  const numRows = Math.ceil(this.vals.length / numCols);
		  const forceSpace = 1; //manually specify extra space between values

		  //format rests and ties		  
		  const replacedVals = this.vals.map((value,index) => {
		  	  if( Array.isArray(this.vals[index])) return value;
			  else if (value < -999999990) {
			    return '_';
			  } else if (value < -27654321) {
			    return '^'
			  } else {
			    return value;
			  }
			});
			

		  const maxLength = Math.max(...replacedVals.map(value => value.toString().length)) + forceSpace;

			// Format and align values vertically
			const formattedValues = replacedVals.map(value => {
				let valueString = value.toString();
				if(value < -999999990) valueString = '_'
				else if( value < -27654321 ) valueString = '&nbsp;'
				const leadingSpaces = '&nbsp;'.repeat(maxLength - valueString.length);
				return leadingSpaces + valueString;
			});
			
			//highlight vurrent value
			formattedValues[this.valsInd] = `<span style="font-weight: bold; color: red;">${formattedValues[this.valsInd]}</span>`

			//generate rows of values
		  for (let i = 0; i < numRows; i++) {
		    const rowValues = formattedValues.slice(i * numCols, (i + 1) * numCols);
		    const formattedRow = rowValues.map((value, index) => {
		      value = value < -999999990 ? '_' : value < -27654321 ? '&nbsp;' : value
		      if (index%4 === 3) {
		        return '' + value + '&emsp;&emsp;'; // Add a tab space between the first and last 4 values
		      } else {
		        return value + '';
		      }
		    });
		    rows.push(formattedRow.join('\t')); // Join values with tabs
		  }

		  // Add a blank line after every 4 rows
		  const formattedTextWithBlankLines = [];
		  for (let i = 0; i < rows.length; i++) {
		    formattedTextWithBlankLines.push(rows[i]);
		    if (i % 4 == 3 ) {
		      formattedTextWithBlankLines.push('\r\r'); // Add a blank line
		    }
		  }

		  const formattedText = formattedTextWithBlankLines.join('\n'); // Join rows with line breaks

		  textSources[this.name + '.vals'] = formattedText
		  textHeaders[this.name + '.vals'] = 'Sequencer ' + this.name + ' values'
		  //curDisplaySource = this.name
		  updateDisplay()
	}

}