//math shortcuts

// import { floor,ceil,peak,round,trunc,abs,cos,random} from './midiMath.js'

export let floor = function(val){
  if(val < -100000) return _
  return Math.floor(val)
}


export let ceil = function(val){
  if(val < -100000) return _
  return Math.ceil(val)
}


export let peak = function(val){
  if(val < -100000) return _
  return Math.ceil(val)
}


export let round = function(val){
  if(val < -100000) return _
  return Math.round(val)
}


export let trunc = function(val){
  if(val < -100000) return _
  return Math.trunc(val)
}


export let abs = function(val){
  if(val < -100000) return _
  return Math.abs(val)
}


export let cos = function(val){
  if(val < -100000) return _
  return Math.cos(val)
}

export let random = function(val = 1){
  return Math.random() * val
}