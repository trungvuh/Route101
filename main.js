
const fps = 60;
var step = 1/fps;
var width         = 1024;                    // logical canvas width
var height        = 768;                     // logical canvas height
var segments      = [];                      // array of road segments
// var stats         = Game.stats('fps');       // mr.doobs FPS counter
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
var cameraHeight  = 1000;                    // y height of camera
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


function update(dt) {

  position = Util.increase(position, dt * speed, trackLength);
  var dx = dt * 2 * (speed/maxSpeed);

  if (keyLeft) {
    playerX = playerX - dx;
  }
  else if (keyRight) {
    playerX = playerX + dx;
  }

  if (keyFaster) {
    speed = Util.accelerate(speed, accel, dt);
  }
  else if (keySlower) {
    speed = Util.accelerate(speed, breaking, dt);
  }

  if ( ((playerX < -1) || (playerX > 1)) && (speed > offRoadLimit)) {
    speed = Util.accelerate(speed, offRoadDecel, dt);
  }

  playerX = Util.limit(playerX, -2, 2); //limit position out of bounds
  speed = Util.limit(speed, 0, maxSpeed); //limit maxSpeed
}


/////////// build the road

function resetRoad() {
  segments = [];
  for(var n = 0; n < 500; n++) {
    segments.push({
      index: n,
      p1: {
        world: { z: n * segmentLength },
        camera: {},
        screen: {}
      },
      p2: {
        world: { z: (n+1) * segmentLength },
        camera: {},
        screen: {}
      },
      color: Math.floor(n/rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT
    });
  }

  segments[findSegment(playerZ).index + 2].color = COLORS.START;
  segments[findSegment(playerZ).index + 3].color = COLORS.START;

  for (var n = 0; n < rumbleLength; n++) {
    segments[segments.length - 1 - n].color = COLORS.FINISH;
  }
  trackLength = segments.length * segmentLength;
}

function findSegment(z) {
  return segments[Math.floor(z/segmentLength) % segments.length];
}


///////////render the game

function render() {

  var baseSegment = findSegment(position);
  var maxy = height;

  ctx.clearRect(0,0, width, height); //clear canvas every frame

  Render.background(ctx, background, width, height, BACKGROUND.SKY);
  Render.background(ctx, background, width, height, BACKGROUND.HILSS);
  Render.background(ctx, background, width, height, BACKGROUND.TREES);

  var n, segment;

  for(n=0; n < drawDistance; n++) {
    segment = segments[(baseSegment.index + n) % segments.length];
    segment.looped = segment.index < baseSegment.index;
    segment.fog = Util.exponentioalFog(n/drawDistance, fogDensity);
  }

  Util.project(
    segment.p1,
    (playerX * roadWidth), //x position of camera
    cameraHeight, //height y position of camera
    position - (segment.looped ? trackLength : 0), //z position of camera
    cameraDepth, // z-depth of camera
    width,
    height,
    roadWidth
  );
  Util.project(
    segment.p2,
    (playerX * roadWidth), //x position of camera
    cameraHeight, //height y position of camera
    position - (segment.looped ? trackLength : 0), //z position of camera
    cameraDepth, // z-depth of camera
    width,
    height,
    roadWidth
  );

  if ( (segment.p1.camera.z <= cameraDepth) ||  //camera behind
        (segment.p2.screen.y >= maxy)) continue;

  Render.segment(ctx, width, lanes,
    segment.p1.screen.x,
    segment.p1.screen.y,
    segment.p1.screen.w,
    segment.p2.screen.x,
    segment.p2.screen.y,
    segment.p2.screen.w,
    segment.fog,
    segment.color
  );

  Render.player(ctx, width, height,
    resolution, roadWidth, sprites, speed/maxSpeed,
    caemraDepth/playerZ,
    width/2,
    height,
    speed * (keyLeft ? -1 : keyRight ? 1 : 0),
    0
  )
}

/////// Game Loop

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
  resolution             = height/480;
  refreshTweakUI();

  if ((segments.length==0) || (options.segmentLength) || (options.rumbleLength)) {
    resetRoad();
  }
}
