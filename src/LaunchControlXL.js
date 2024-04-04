import { sendNote2 } from "./midiControl.js";

/*
Hex Decimal Colour Brightness
0Ch 12 Off Off
0Dh 13 Red Low
0Fh 15 Red Full
1Dh 29 Amber Low
3Fh 63 Amber Full
3Eh 62 Yellow Full
1Ch 28 Green Low
3Ch 60 Green Full

Values for flashing LEDs are:
Hex Decimal Colour Brightness
0Bh 11 Red Full
3Bh 59 Amber Full
3Ah 58 Yellow Full
38h 56 Green Full

*/

export class LaunchControlXL {
  constructor() {
  	//midi note numbers for LCXL
  	this.topKnobNotes = [13,29, 45, 61, 77, 93, 109, 125]
	this.buttonNotes = [41, 57, 73, 89]
    // Define note numbers for LEDs
    this.leds = {
      userKnob: [0, 1, 2],
      userButton: [8, 9],
      factoryKnob: [16, 17, 18],
      factoryButton: [24, 25]
    };
    

    this.colorMap = {
      'dimRed': 13,
      'red': 15,
      'dimGreen': 28,
      'green': 60,
      'dimAmber': 29,
      'amber': 63,
      'yellow': 62,
      'off': 0
      // Add more color mappings as needed
    };

    // Initialize tracks
    this.track = Array.from({ length: 8 }, () => ({
      knob: [
        { note: 0, value: 0 },
        { note: 0, value: 0 },
        { note: 0, value: 0 }
      ],
      button: [
      	{ note: 0, value: 0 },
        { note: 0, value: 0 },
        ]
    }));

    for(let i=0;i<8;i++){
    	for(let j=0;j<3;j++){
    		this.track[i].knob[j].note = this.topKnobNotes[i]+j
    	}
    	for(let j=0;j<2;j++){
    		this.track[i].button[j].note = this.buttonNotes[Math.floor(i/4)+j*2]+i
    	}
    }

    this.curBank = 'factory';


    // Initialize LED states for user and factory banks
    this.userLedState = {
      knob: [false, false, false],
      button: [false, false]
    };

    this.factoryLedState = {
      knob: [false, false, false],
      button: [false, false]
    };
  }

  // Method to set LED brightness for a specific LED
  setLed(led, val) {
  	// Check if the provided val is a string
    if (typeof val === 'string') {
      // Check if the string representation exists in the colorMap
      if (this.colorMap.hasOwnProperty(val)) {
        // If exists, set val to the corresponding integer value
        val = this.colorMap[val];
      } else {
        console.error("Invalid color string");
        return;
      }
    }
    // Check if the LED is a knob
    let channel = this.curBank == 'factory' ? 1 : 9
    if (led.hasOwnProperty('note') && led.hasOwnProperty('value')) {
      sendNote2(led.note, val, channel)
      console.log(`Setting LED with note ${led.note} to brightness ${val}`);
      // For demonstration, we're just logging the action here
    } else {
      console.error("Invalid LED format");
    }
  }

  setBank(name){
  	if(name == 'user') this.curBank = 'user'
  	else this.curBank = 'factory'
  }

  // // Method to turn off LED for user knob
  // turnOffUserKnobLED(index) {
  //   const note = this.leds.userKnob[index];
  //   // Code to send MIDI message to turn off LED with note number 'note'
  //   this.userLedState.knob[index] = false;
  // }

  // // Method to turn on LED for user button
  // turnOnUserButtonLED(index) {
  //   const note = this.leds.userButton[index];
  //   // Code to send MIDI message to turn on LED with note number 'note'
  //   this.userLedState.button[index] = true;
  // }

  // // Method to turn off LED for user button
  // turnOffUserButtonLED(index) {
  //   const note = this.leds.userButton[index];
  //   // Code to send MIDI message to turn off LED with note number 'note'
  //   this.userLedState.button[index] = false;
  // }

  // // Similarly, you can add methods for factory knobs and buttons

  // // Method to get current LED state for user bank
  // getUserLedState() {
  //   return this.userLedState;
  // }

  // // Method to get current LED state for factory bank
  // getFactoryLedState() {
  //   return this.factoryLedState;
  // }
}
