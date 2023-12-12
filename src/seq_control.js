import { globalClock, major, minor, scale, beatsPerMeasure } from './main.js';
import { muted, midi, outputMidiID, beat } from './midi_control.js';
import { floor, ceil } from "./midi_math.js"


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
	globalClock = 0;
}

function checkChannel(channel) {
	if (channel > 16) {
		console.warn("Cannot have a channel larger than 16. Using channel 1.");
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
		this.lastNoteSent = null;
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
		var noteNum = this.curVal;
		//send note off if value is not ≈ (tie), e.g. -87654321
		if (noteNum > -900000000 && noteNum < -7000000) return;
		this.sendNoteOff(this.lastNoteSent, this.channel);

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
		if (midiNote < 0 || midiNote == null || midiNote > 127) { return; }

		//send MIDI msg
		const noteOnMessage = [0x90 + this.channel - 1, midiNote, this.velocity];    // 0x90 note on + channel, midi pitch num, velocity
		var output = midi.outputs.get(outputMidiID);
		output.send(noteOnMessage);

		this.lastNoteSent = midiNote;

		//for console logging
		if (this.monitor) console.log(this.name + ' midi: ' + midiNote, ' vel: ' + this.velocity);
	}

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
			return null;
		}
		var note = this.vals[Math.round(this.valsInd >= 0 ? this.valsInd : (this.vals.length - this.valsInd))];
		//below removes increment and moves this to updatevalsIndex()

		this.updatevalsIndex()
		//handle negative indexes
		var sign = this.valsInd != 0 ? Math.round(this.valsInd / Math.abs(this.valsInd)) : 1;

		this.valsInd = this.valsInd * sign;
		this.valsInd = Math.round(((this.valsInd) % this.vals.length) * sign);

		var nextStep = null;
		if (typeof this.durs !== 'number') {
			nextStep = this.durs[floor(this.dursInd)];
		} else {
			nextStep = this.durs;
		}
		this.nextValTime = globalClock + nextStep * 24 * 4;

		//take care of incrementing durssation index in case where durs is an array
		if (typeof this.durs !== 'number') {
			this.dursInd = (this.dursInd + 1) % this.durs.length;
		} else {
			this.updateDurIndex();
		}

		return note
	}

	updatevalsIndex() { this.valsInd = (this.valsInd + this.noteInc) }

	updateDurIndex() { this.dursInd = (this.dursInd + this.dursInc) }

	repopulate() {
		this.newVals = [];
		this.repopulating = true;
	}

	stopPop() {
		if (this.valsInd >= this.newVals.length) {
			this.valsInd = this.newVals.length - 1;
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

	start() {
		this.stopped = false;
	}

	reset() {
		this.valsInd = 0;
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

	updateArrays() {
		if (this.valsName) {
			var newVals = eval('globalThis.' + this.valsName);
			this.valsInd = this.valsInd % newVals.length;
			this.vals = newVals;
		}
		if (this.dursName) {
			var newDurs = eval('globalThis.' + this.dursName);
			if (Array.isArray(newDurs)) {
				this.dursInd = this.dursInd % newDurs.length;
			}
			this.durs = newDurs;
		}
	}

}