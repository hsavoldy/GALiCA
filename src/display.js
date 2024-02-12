export const textSources = {
  default: 'default',
  algAssignment: "",
  algs: "",
  // Add more sources as needed
};

export const textHeaders = {
  default: 'How to use the display',
  algAssignment: "Algorithm assignments",
  algs: "Available algorithms",
  sequencer: "Sequencer Vals",
  user: "User text"
  // Add more sources as needed
}

export let curDisplaySource = ['default', 'default']

export function display(div, source) {
  if( div === 'divA' || div === 'div A'){
    curDisplaySource[0] = source
  } else if ( div === 'divB' || div === 'div B'){
    curDisplaySource[1] = source
  }
  else { curDisplaySource[0] = 'default'}
  updateDisplay()
}

export function updateDisplay(){
  updateDefaultText()
  const topDiv = document.getElementById("divA");
  const botDiv = document.getElementById("divB");

  
  let headerText = `<h2>${textHeaders[curDisplaySource[0]] || textHeaders['default']}</h2>`;
  let bodyText = textSources[curDisplaySource[0]] || textSources['default'];
  topDiv.innerHTML = headerText + bodyText;
  
  headerText = `<h2>${textHeaders[curDisplaySource[1]] || textHeaders['default']}</h2>`;
  bodyText = textSources[curDisplaySource[1]] || textSources['default'];
  botDiv.innerHTML = headerText + bodyText;
  //topDiv.textContent = textSources[curDisplaySource] || textSources['default']
  //botDiv.textContent = textSources[curDisplaySource] || textSources['default']
}

function updateDefaultText(){
  textSources.default = `
    Choose a source to display in this div using the function display(div, source).
    
    To display the values of a sequencer called 'a' try:
    
    display( 'divA', 'a')
    
    Available sources are: 
    * ${Object.keys(textSources).join('\n* ')}`
}

updateDisplay()