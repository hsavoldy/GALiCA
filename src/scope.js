//example of P5.js code in instance mode
//https://youtu.be/Su792jEauZg


const scope_sketch = function(scoop) {

  scoop.x_size = 600
  scoop.y_size = 250

   scoop.setup = function() {
    scoop.createCanvas(scoop.x_size, scoop.y_size);
    //scoop.canvas.parent('scope_div'); //'visuals is the name of the div to draw into'


     scoop.noStroke();
     scoop.fill(40, 200, 40);

    //slow down draw rate
     scoop.frameRate(30)

     scoop.stroke(50,50,50);
  }

  scoop.samplesToDraw = [0,0,0]
  scoop.peakAmplitude = 0.0001
  scoop.scopeVerticalScale = 1

   scoop.drawSample = function(vals){
    for (scoop.i=0; scoop.i< vals.length; scoop.i++){
      scoop.samplesToDraw[ scoop.i] =  vals[ scoop.i]
      if(scoop.abs( vals[ scoop.i]) >  scoop.peakAmplitude) {
         scoop.peakAmplitude =  vals[ scoop.i]
         scoop.scopeVerticalScale = (scoop.y_size/2)/ scoop.peakAmplitude
      }
    }
    console.log('added samples: ', scoop.samplesToDraw.length)

    console.log('peak amplitude: ', scoop.peakAmplitude)
    console.log('scopeVerticalScale: ', scoop.scopeVerticalScale)
  }

  scoop.sampleWidth = 10

  scoop.setBackground = function(val){
    scoop.background(val, val, val)
  }

  scoop.drawLine = function(a,b,c,d){
    scoop.line(a,b,c,d)
  }

  scoop.draw = function() {
    scoop.background(255,255,255)
    scoop.strokeWeight( scoop.sampleWidth)
    scoop.x_pos =  scoop.sampleWidth/2

    for(scoop.i=0; scoop.i< scoop.samplesToDraw.length; scoop.i++){
       scoop.line( scoop.x_pos,scoop.y_size/2, scoop.x_pos,scoop.y_size/2 - scoop.samplesToDraw[ scoop.i]* scoop.scopeVerticalScale)
       scoop.x_pos += scoop.sampleWidth
    }

  //   if (scoop.mouseIsPressed) {
  //     console.log(scoop.mouseX,scoop.mouseY)
  //     scoop.line(0,0,scoop.mouseX,scoop.mouseY)
  // } 

    //console.log('scope')
  }

}

var mainScope = new p5(scope_sketch, document.getElementById('scope_div'))
