
export const starterCode = [
	'setMidiInput(1);',
	'setMidiOutput(1);',
	'setMidiClock(false);',
	'\n',
	'an = Array.from({length:16},(x,i)=> i%12%3 == 0 ? floor(i/3) : i<8 ? _ : ^)',
	'a = new Seq(an, 1/8, 1) //values, durations, midi channel',
	'\n',
	'addToAlgs("globalClock % 8 < 4")',
	'addToAlgs("globalClock % 8 == 0")',
	'assignAlg("b", 16)',
	];

export var cachedCode = localStorage.getItem("userCode");

//inputs and outputs are the available midi ports
export function createStarterText(midiText){
	var instructions = [
		'To run code:',
		'Ctrl-Enter: Run selected line',
		'Alt-Enter: Run selected block',
		'underscore (_) generates a rest',
		'shift-6 (^) generates a tie'
		]
	var text = instructions.reduce(
		function (output, str) { return output + '\n' + str ;}
		);

	var code = starterCode.reduce(
		function (output, str) { return output + '\n' + str ;}
		);

	return (cachedCode) ? cachedCode : '/*\n' + text + '\n\n' + midiText + '*/\n\n' + code;
}