// clockWorker.js
let timer;

function startTimer(interval) {
  clearInterval(timer);
  timer = setInterval(() => {
    const currentTime = new Date();
    self.postMessage(currentTime);
  }, interval);
}

self.addEventListener('message', (event) => {
  if (event.data.type === 'start') {
    startTimer(event.data.interval);
  } else if (event.data.type === 'changeInterval') {
    startTimer(event.data.interval);
  } else if (event.data.type === 'getCurrentTime') {
    const currentTime = new Date();
    self.postMessage(currentTime);
  } else if (event.data.type === 'stop') {
    clearInterval(timer);
  }
});

// // self.dur=1000;
// // self.callback = null;
// self.addEventListener('message', (event) => {
//    if (event.data === 'start') {
//      setInterval(() => {
//        const currentTime = new Date();
//        self.postMessage(currentTime);
//       //  self.callback;
//      }, 1000); // Update the clock every second
//    }
//  });
