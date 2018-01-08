# Route 66

## [Live Demo](https://trungvuh.github.io/Route66/)

### Overview

I always have a strong passion for racing game. My very first attempt to build a racing game was a simple canvas game, Car Racing, which could be found [here](https://github.com/trungvuh/Racing), or [click here](https://trungvuh.github.io/Racing/) to play. After that, I always wanted to build something else much more interesting. So here it is, my latest project, Route 66.

This project is still very far from being a final/ finished product. There are tons of other features that I wish I had time to implement (i.e. better AI, other racers, track options or car options, etc.), but for now, it is pretty much where I want it to be.

**Note:** although it may appear to be a 3D project, there is no 3D (such as Three.js or WebGL) technology used in this project. This is a pseudo-3D project, built solely on HTML5 using JavaScript and CSS to achieve a more realistic feeling of those old time arcade games.

![](https://github.com/trungvuh/Route66/raw/master/images/intro.gif)

## Features

### Pseudo-3D

In order to create a realistic 3D feeling, I used the translating - projecting - scaling technique that was introduce by **Louis Gorenfeld** and **Jakes Gordon** (reference below). The world coordinates will be translated to camera coordinates, which then be projected onto a normalized projection screen, and finally be scaled down to our physical (canvas) screen coordinates. Details explained in the diagram below:

![](https://github.com/trungvuh/Route66/raw/master/images/equations.png)

Building a road is a fun part, especially when it comes to build a curve. Since each segment of the road is basically a polygon by itself, we can "shift" the next road segment by a small dx amount, and "curve" the road to where we want it to be.

![](https://github.com/trungvuh/Route66/raw/master/images/curves.png)

### Collision

For collision with the sprite, at first it was hard because the player can not go back in frame, thus gets stuck in front of the sprite. So I have to "cheat" a little:

```JavaScript
//detect collision with Sprites
for(n = 0 ; n < playerSegment.sprites.length ; n++) {
  sprite  = playerSegment.sprites[n];
  spriteW = sprite.source.w * SPRITES.SCALE;
  if (Util.overlap(playerX, playerW, sprite.offset + spriteW/2 * (sprite.offset > 0 ? 1 : -1), spriteW)) {
    speed = maxSpeed/5;
    position = Util.increase(playerSegment.p1.world.z, -playerZ, trackLength); // stop in front of sprite (at front of segment)
    collisionSprite.play(); //collision sound
    break;
  }
}
```

### Speed

For the speed, one thing to note is that the speed of the player is "calculated" by how fast the player's car is passing through each segments, or in other words, how many segments the player is passing in each frame. Hence, when increasing or decreasing the FOV (field of view, which means how much those segments will get "stretched"/ scaled/ rendered out onto the canvas), user will see the effect of the player's car appears to move much faster or slower, respectively.

```JavaScript
function update(dt) {

  //...
  var fps           = 60;                      // how many 'update' frames per second
  var step          = 1/fps;                   // how long is each frame (in seconds)
  var speed         = 0;                       // current speed
  var segmentLength = 250;                     // length of a single segment
  var maxSpeed      = segmentLength/step;      // top speed
  var accel         =  maxSpeed/5;             // acceleration rate - tuned until it 'felt' right
  var breaking      = -maxSpeed/2;               // deceleration rate when braking
  var decel         = -maxSpeed/5;             // 'natural' deceleration rate when neither accelerating, nor braking
  var offRoadDecel  = -maxSpeed/2;             // off road deceleration is somewhere in between
  var offRoadLimit  =  maxSpeed/4;             // limit when off road deceleration no longer applies

  var n, car, carW, sprite, spriteW;
  var playerSegment = findSegment(position+playerZ);
  var playerW       = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;
  var speedPercent  = speed/maxSpeed;
  var dx            = dt * 2 * speedPercent;
  // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
  var startPosition = position;

  updateCars(dt, playerSegment, playerW);

  position = Util.increase(position, dt * speed, trackLength);

  if (keyLeft) {
    playerX = playerX - dx;
  }
  else if (keyRight) {
    playerX = playerX + dx;
  }

  playerX = playerX - (dx * speedPercent * playerSegment.curve * centrifugal);

  if (keyFaster) {
    speed = Util.accelerate(speed, accel, dt);
  }
  else if (keySlower) {
    speed = Util.accelerate(speed, breaking, dt);
  }
  else {
    speed = Util.accelerate(speed, decel, dt);
  }

  //...
}
```  


### AI

The most challenging part of the project may be the AI. To make all of them know to "steer" around the others and not going through was the hard part. For that, I have each car:

  + lookahead 20 segments
  + if it detects a slower car ahead that overlaps, then steer around it
  + steer to the right of obstacles that are on the left side of the road
  + steer to the left of obstacles that are on the right side of the road
  + steer enough to avoid the obstacle ahead within the distance remaining
  + if it is out of sight of the player, just don't bother doing any of the above.

```JavaScript
function updateCarOffset(car, carSegment, playerSegment, playerW) {

  var i, j, dir, segment, otherCar, otherCarW, lookahead = 20;
  var carW = car.sprite.w * SPRITES.SCALE;

  // dont bother steering around other cars when they are 'out of sight' of the player
  if ((carSegment.index - playerSegment.index) > drawDistance)
    return 0;

  for(i = 1 ; i < lookahead ; i++) {
    segment = segments[(carSegment.index+i)%segments.length];

    for(j = 0 ; j < segment.cars.length ; j++) {
      otherCar  = segment.cars[j];
      otherCarW = otherCar.sprite.w * SPRITES.SCALE;

      if ((car.speed > otherCar.speed) && Util.overlap(car.offset, carW, otherCar.offset, otherCarW, 1.2)) {
        if (otherCar.offset > 0.5) { //to the right, steer left
          dir = -1;
        }
        else if (otherCar.offset < -0.5) { //to the left, steer right
          dir = 1;
        }
        else {
          dir = (car.offset > otherCar.offset) ? 1 : -1;
          return dir * 1/i * (car.speed-otherCar.speed)/maxSpeed;
        }
      }
    }
  }
}
```

## Working on:

Actually racing against other cars. The challenging problem will be to detect when the opponent is changing place from ahead to behind, and vice versa.

## Future Improvement:

  + Better AI - sometimes the cars didn't detect the other cars ahead fast enough to steer around, thus resulting in a go-through animation.
  + Ranking, last lap, etc.
  + Options for multiple tracks, cars, music
  + Shooting, special ability items?

## Credits

  + **Louis Gorenfeld** for his technique in building and rendering a pseudo-3D world game. Without his blog, this project can not be done. Details can be found [here](http://www.extentofthejam.com/pseudo/)

  + **Jakes Gordon** for his very details step-by-step tutorial on how to build a racing game. His tutorial was what helped me the most in understanding about how all the little components of the game interact with each other. Details can be found [here](https://codeincomplete.com/posts/javascript-racer-v1-straight/)

  + **Pixel Warehouse** and **Sega Senesis** for all the graphic contents in this game. It can be found [here](http://pixel.garoux.net/?scr=sprites&game_id=44&p=1)

  + Some of the billboards are also 'personalized'. Can you spot what they are?
