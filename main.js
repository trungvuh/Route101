var fps           = 60;                      // how many 'update' frames per second
var step          = 1/fps;                   // how long is each frame (in seconds)
var width         = 1024;                    // logical canvas width
var height        = 768;                     // logical canvas height
var centrifugal   = 0.3;                     // centrifugal force multiplier when going around curves
var offRoadDecel  = 0.99;                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
var skySpeed      = 0.001;                   // background sky layer scroll speed when going around curve (or up hill)
var hillSpeed     = 0.002;                   // background hill layer scroll speed when going around curve (or up hill)
var treeSpeed     = 0.003;                   // background tree layer scroll speed when going around curve (or up hill)
var skyOffset     = 0;                       // current sky scroll offset
var hillOffset    = 0;                       // current hill scroll offset
var treeOffset    = 0;                       // current tree scroll offset
var segments      = [];                      // array of road segments
var stats         = Game.stats('fps');       // mr.doobs FPS counter
var canvas        = Dom.get('canvas');       // our canvas...
var ctx           = canvas.getContext('2d'); // ...and its drawing context
var background    = null;                    // our background image (loaded below)
var sprites       = null;                    // our spritesheet (loaded below)
var resolution    = null;                    // scaling factor to provide resolution independence (computed)
var roadWidth     = 2000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
var segmentLength = 200;                     // length of a single segment
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
var breaking      = -maxSpeed;               // deceleration rate when braking
var decel         = -maxSpeed/5;             // 'natural' deceleration rate when neither accelerating, nor braking
var offRoadDecel  = -maxSpeed/2;             // off road deceleration is somewhere in between
var offRoadLimit  =  maxSpeed/4;             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)

var keyLeft       = false;
var keyRight      = false;
var keyFaster     = false;
var keySlower     = false;

//=========================================================================
// UPDATE THE GAME WORLD
//=========================================================================

function update(dt) {

  var playerSegment = findSegment(position+playerZ);
  var speedPercent  = speed/maxSpeed;
  var dx            = dt * 2 * speedPercent; // at top speed, should be able to cross from left to right (-1 to +1) in 1 second

  position = Util.increase(position, dt * speed, trackLength);

  skyOffset  = Util.increase(skyOffset,  skySpeed  * playerSegment.curve * speedPercent, 1);
  hillOffset = Util.increase(hillOffset, hillSpeed * playerSegment.curve * speedPercent, 1);
  treeOffset = Util.increase(treeOffset, treeSpeed * playerSegment.curve * speedPercent, 1);

  if (keyLeft)
    playerX = playerX - dx;
  else if (keyRight)
    playerX = playerX + dx;

  playerX = playerX - (dx * speedPercent * playerSegment.curve * centrifugal);

  if (keyFaster)
    speed = Util.accelerate(speed, accel, dt);
  else if (keySlower)
    speed = Util.accelerate(speed, breaking, dt);
  else
    speed = Util.accelerate(speed, decel, dt);

  if (((playerX < -1) || (playerX > 1)) && (speed > offRoadLimit))
    speed = Util.accelerate(speed, offRoadDecel, dt);

  playerX = Util.limit(playerX, -2, 2);     // dont ever let player go too far out of bounds
  speed   = Util.limit(speed, 0, maxSpeed); // or exceed maxSpeed

}

//=========================================================================
// RENDER THE GAME WORLD
//=========================================================================

function render() {

  var baseSegment = findSegment(position);
  var basePercent = Util.percentRemaining(position, segmentLength);
  var maxy        = height;

  var x  = 0;
  var dx = - (baseSegment.curve * basePercent);

  ctx.clearRect(0, 0, width, height);

  Render.background(ctx, background, width, height, BACKGROUND.SKY,   skyOffset);
  Render.background(ctx, background, width, height, BACKGROUND.HILLS, hillOffset);
  Render.background(ctx, background, width, height, BACKGROUND.TREES, treeOffset);

  var n, segment;

  for(n = 0 ; n < drawDistance ; n++) {

    segment        = segments[(baseSegment.index + n) % segments.length];
    segment.looped = segment.index < baseSegment.index;
    segment.fog    = Util.exponentialFog(n/drawDistance, fogDensity);

    Util.project(segment.p1, (playerX * roadWidth) - x,      cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);
    Util.project(segment.p2, (playerX * roadWidth) - x - dx, cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);

    x  = x + dx;
    dx = dx + segment.curve;

    if ((segment.p1.camera.z <= cameraDepth) ||  // behind us
        (segment.p2.screen.y >= maxy))           // clip by (already rendered) segment
      continue;

    Render.segment(ctx, width, lanes,
                   segment.p1.screen.x,
                   segment.p1.screen.y,
                   segment.p1.screen.w,
                   segment.p2.screen.x,
                   segment.p2.screen.y,
                   segment.p2.screen.w,
                   segment.fog,
                   segment.color);

    maxy = segment.p2.screen.y;
  }

  Render.player(ctx, width, height, resolution, roadWidth, sprites, speed/maxSpeed,
                cameraDepth/playerZ,
                width/2,
                height,
                speed * (keyLeft ? -1 : keyRight ? 1 : 0),
                0);
}

//=========================================================================
// BUILD ROAD GEOMETRY
//=========================================================================



function resetRoad() {
  segments = [];

  addStraight(ROAD.LENGTH.SHORT/4);
  addSCurves();
  addStraight(ROAD.LENGTH.LONG);
  addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM);
  addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM);
  addStraight();
  addSCurves();
  addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM);
  addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM);
  addStraight();
  addSCurves();
  addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.EASY);

  segments[findSegment(playerZ).index + 2].color = COLORS.START;
  segments[findSegment(playerZ).index + 3].color = COLORS.START;
  for(var n = 0 ; n < rumbleLength ; n++)
    segments[segments.length-1-n].color = COLORS.FINISH;

  trackLength = segments.length * segmentLength;
}

function findSegment(z) {
  return segments[Math.floor(z/segmentLength) % segments.length];
}

//=========================================================================
// THE GAME LOOP
//=========================================================================

Game.run({
  canvas: canvas, render: render, update: update, stats: stats, step: step,
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
  ready: function(images) {
    background = images[0];
    sprites    = images[1];
    reset();
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
  resolution             = height/600;
  refreshTweakUI();

  if ((segments.length==0) || (options.segmentLength) || (options.rumbleLength))
    resetRoad(); // only rebuild road when necessary
}

//=========================================================================
// TWEAK UI HANDLERS
//=========================================================================

// Dom.on('resolution', 'change', function(ev) {
//   var w, h, ratio;
//   switch(ev.target.options[ev.target.selectedIndex].value) {
//     case 'fine':   w = 1280; h = 960;  ratio=w/width; break;
//     case 'high':   w = 1024; h = 768;  ratio=w/width; break;
//     case 'medium': w = 640;  h = 480;  ratio=w/width; break;
//     case 'low':    w = 480;  h = 360;  ratio=w/width; break;
//   }
//   reset({ width: w, height: h })
//   Dom.blur(ev);
// });

Dom.on('lanes',          'change', function(ev) { Dom.blur(ev); reset({ lanes:         ev.target.options[ev.target.selectedIndex].value }); });
Dom.on('roadWidth',      'change', function(ev) { Dom.blur(ev); reset({ roadWidth:     Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
Dom.on('cameraHeight',   'change', function(ev) { Dom.blur(ev); reset({ cameraHeight:  Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
Dom.on('drawDistance',   'change', function(ev) { Dom.blur(ev); reset({ drawDistance:  Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
Dom.on('fieldOfView',    'change', function(ev) { Dom.blur(ev); reset({ fieldOfView:   Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
Dom.on('fogDensity',     'change', function(ev) { Dom.blur(ev); reset({ fogDensity:    Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });

function refreshTweakUI() {
  Dom.get('lanes').selectedIndex = lanes-1;
  Dom.get('currentRoadWidth').innerHTML      = Dom.get('roadWidth').value      = roadWidth;
  Dom.get('currentCameraHeight').innerHTML   = Dom.get('cameraHeight').value   = cameraHeight;
  Dom.get('currentDrawDistance').innerHTML   = Dom.get('drawDistance').value   = drawDistance;
  Dom.get('currentFieldOfView').innerHTML    = Dom.get('fieldOfView').value    = fieldOfView;
  Dom.get('currentFogDensity').innerHTML     = Dom.get('fogDensity').value     = fogDensity;
}
