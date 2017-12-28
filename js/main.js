var fps           = 60;                      // how many 'update' frames per second
var step          = 1/fps;                   // how long is each frame (in seconds)
var width         = 1280;                    // logical canvas width
var height        = 960;                     // logical canvas height
var centrifugal   = 0.3;                     // centrifugal force multiplier when going around curves
var offRoadDecel  = 0.99;                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
var skySpeed      = 0.001;                   // background sky layer scroll speed when going around curve (or up hill)
var hillSpeed     = 0.002;                   // background hill layer scroll speed when going around curve (or up hill)
var treeSpeed     = 0.003;                   // background tree layer scroll speed when going around curve (or up hill)
var skyOffset     = 0;                       // current sky scroll offset
var hillOffset    = 0;                       // current hill scroll offset
var treeOffset    = 0;                       // current tree scroll offset
var segments      = [];                      // array of road segments
var canvas        = Dom.get('canvas');       // our canvas...
var ctx           = canvas.getContext('2d'); // ...and its drawing context
var background    = null;                    // our background image (loaded below)
var sprites       = null;                    // our spritesheet (loaded below)
var resolution    = null;                    // scaling factor to provide resolution independence (computed)
var roadWidth     = 2000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
var segmentLength = 250;                     // length of a single segment
var rumbleLength  = 3;                       // number of segments per red/white rumble strip
var trackLength   = null;                    // z length of entire track (computed)
var lanes         = 3;                       // number of lanes
var fieldOfView   = 100;                     // angle (degrees) for field of view
var cameraHeight  = 1250;                    // z height of camera
var cameraDepth   = null;                    // z distance camera is from screen (computed)
var drawDistance  = 300;                     // number of segments to draw
var playerX       = 0;                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
var playerZ       = null;                    // player relative z distance from camera (computed)
var fogDensity    = 5;                       // exponential fog density
var position      = 0;                       // current camera Z position (add playerZ to get player's absolute Z position)
var speed         = 0;                       // current speed
var maxSpeed      = segmentLength/step;      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
var accel         =  maxSpeed/5;             // acceleration rate - tuned until it 'felt' right
var breaking      = -maxSpeed/2;               // deceleration rate when braking
var decel         = -maxSpeed/5;             // 'natural' deceleration rate when neither accelerating, nor braking
var offRoadDecel  = -maxSpeed/2;             // off road deceleration is somewhere in between
var offRoadLimit  =  maxSpeed/4;             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
var totalCars      = 200;                     // total number of cars on the road
var currentLapTime = 0;                       // current lap time
var lastLapTime    = null;                    // last lap time

var keyLeft       = false;
var keyRight      = false;
var keyFaster     = false;
var keySlower     = false;

//====================================================================
// THE GAME LOOP
//====================================================================

Game.run({
  canvas: canvas, render: render, update: update, step: step,
  images: ["background", "sprites"],
  keys: [
    { keys: [KEY.LEFT,  KEY.A], mode: 'down', action: function() { keyLeft   = true;  } },
    { keys: [KEY.RIGHT, KEY.D], mode: 'down', action: function() { keyRight  = true;  } },
    { keys: [KEY.UP,    KEY.W], mode: 'down', action: function() { keyFaster = true;  } },
    { keys: [KEY.DOWN,  KEY.S], mode: 'down', action: function() { keySlower = true;  } },
    { keys: [KEY.LEFT,  KEY.A], mode: 'up',   action: function() { keyLeft   = false; } },
    { keys: [KEY.RIGHT, KEY.D], mode: 'up',   action: function() { keyRight  = false; } },
    { keys: [KEY.UP,    KEY.W], mode: 'up',   action: function() { keyFaster = false; } },
    { keys: [KEY.DOWN,  KEY.S], mode: 'up',   action: function() { keySlower = false; } }
  ],

  ready(images) {
    background = images[0];
    sprites    = images[1];
    reset();
    Dom.storage.fast_lap_time = Dom.storage.fast_lap_time || 180;
    updateHud('fast_lap_time', formatTime(Util.toFloat(Dom.storage.fast_lap_time)));
  }
});

function reset(options) {
  options       = options || {};
  canvas.width  = width  = Util.toInt(options.width,          width);
  canvas.height = height = Util.toInt(options.height,         height);
  lanes                  = Util.toInt(options.lanes,          lanes);
  roadWidth              = Util.toInt(options.roadWidth,      roadWidth);
  cameraHeight           = Util.toInt(options.cameraHeight,   cameraHeight);
  drawDistance           = Util.toInt(options.drawDistance,   drawDistance);
  fogDensity             = Util.toInt(options.fogDensity,     fogDensity);
  fieldOfView            = Util.toInt(options.fieldOfView,    fieldOfView);
  segmentLength          = Util.toInt(options.segmentLength,  segmentLength);
  rumbleLength           = Util.toInt(options.rumbleLength,   rumbleLength);
  cameraDepth            = 1 / Math.tan((fieldOfView/2) * Math.PI/180);
  playerZ                = (cameraHeight * cameraDepth);
  resolution             = height/480;
  refreshTweakUI();

  if ((segments.length === 0) || (options.segmentLength) || (options.rumbleLength)) {
    resetRoad(); // only rebuild road when necessary
  }
}

//=========================================================================
// TWEAK UI HANDLERS
//=========================================================================

Dom.on('lanes', 'change', (ev) => {
  Dom.blur(ev);
  reset({ lanes: ev.target.options[ev.target.selectedIndex].value });
});

Dom.on('roadWidth', 'change', (ev) => {
  Dom.blur(ev);
  reset({
    roadWidth: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max')))
  });
});

Dom.on('cameraHeight', 'change', (ev) => {
  Dom.blur(ev);
  reset({
    cameraHeight: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max')))
  });
});

Dom.on('drawDistance', 'change', (ev) => {
  Dom.blur(ev);
  reset({
    drawDistance: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max')))
  });
});

Dom.on('fieldOfView', 'change', (ev) => {
  Dom.blur(ev);
  reset({
    fieldOfView: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max')))
  });
});

Dom.on('fogDensity', 'change', (ev) => {
  Dom.blur(ev);
  reset({
    fogDensity: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max')))
  });
});

function refreshTweakUI() {
  Dom.get('lanes').selectedIndex = lanes-1;
  Dom.get('currentRoadWidth').innerHTML      = Dom.get('roadWidth').value      = roadWidth;
  Dom.get('currentCameraHeight').innerHTML   = Dom.get('cameraHeight').value   = cameraHeight;
  Dom.get('currentDrawDistance').innerHTML   = Dom.get('drawDistance').value   = drawDistance;
  Dom.get('currentFieldOfView').innerHTML    = Dom.get('fieldOfView').value    = fieldOfView;
  Dom.get('currentFogDensity').innerHTML     = Dom.get('fogDensity').value     = fogDensity;
}
