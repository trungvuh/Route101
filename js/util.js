//=====================================================================
// DOM helpers
//=====================================================================

const Dom = {

  get(id) {
    return ((id instanceof HTMLElement) || (id === document)) ? id : document.getElementById(id);
  },

  set(id, html) {
    Dom.get(id).innerHTML = html;
  },

  on(ele, type, fn, capture) {
    Dom.get(ele).addEventListener(type, fn, capture);
  },

  un(ele, type, fn, capture) {
    Dom.get(ele).removeEventListener(type, fn, capture);
  },

  show(ele, type) {
    Dom.get(ele).style.display = (type || 'block');
  },

  blur(ev) {
    ev.target.blur();
  },

  addClassName(ele, name) {
    Dom.toggleClassName(ele, name, true);
  },

  removeClassName(ele, name) {
    Dom.toggleClassName(ele, name, false);
  },

  toggleClassName(ele, name, on) {
    ele = Dom.get(ele);
    var classes = ele.className.split(' ');
    var n = classes.indexOf(name);
    on = (typeof on === 'undefined') ? (n < 0) : on;
    if (on && (n < 0)) {
      classes.push(name);
    }
    else if (!on && (n >= 0)) {
      classes.splice(n, 1);
    }
    ele.className = classes.join(' ');
  },

  storage: window.localStorage || {}

};

//=====================================================================
// general purpose helpers (mostly math)
//=====================================================================

const Util = {

  timestamp() {
    return new Date().getTime();
  },

  toInt(obj, def) {
    if (obj !== null) {
      var x = parseInt(obj, 10); if (!isNaN(x)) return x;
    }
    return Util.toInt(def, 0);
  },

  toFloat(obj, def) {
    if (obj !== null) {
      var x = parseFloat(obj);
      if (!isNaN(x)) return x;
    }
    return Util.toFloat(def, 0.0);
  },

  limit(value, min, max) {
    return Math.max(min, Math.min(value, max));
  },

  randomInt(min, max) {
    return Math.round(Util.interpolate(min, max, Math.random()));
  },

  randomChoice(options) {
    return options[Util.randomInt(0, options.length-1)];
  },

  percentRemaining(n, total) {
    return (n%total)/total;
  },

  accelerate(v, accel, dt) {
    return v + (accel * dt);
  },

  interpolate(a,b,percent) {
    return a + (b-a) * percent;
  },

  easeIn(a,b,percent) {
    return a + (b-a) * Math.pow(percent, 2);
  },

  easeOut(a,b,percent) {
    return a + (b-a) * (1-Math.pow(1-percent, 2));
  },

  easeInOut(a,b,percent){
    return a + (b-a) * ((-Math.cos(percent * Math.PI)/2) + 0.5);
  },

  exponentialFog(distance, density) {
    return 1 / (Math.pow(Math.E, (distance * distance * density)));
  },

  increase(start, increment, max) {
    var result = start + increment;
    while (result >= max) {
      result -= max;
    }
    while (result < 0) {
      result += max;
    }
    return result;
  },

  project(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
    p.camera.x     = (p.world.x || 0) - cameraX;
    p.camera.y     = (p.world.y || 0) - cameraY;
    p.camera.z     = (p.world.z || 0) - cameraZ;
    p.screen.scale = cameraDepth/p.camera.z;
    p.screen.x     = Math.round((width/2)  + (p.screen.scale * p.camera.x  * width/2));
    p.screen.y     = Math.round((height/2) - (p.screen.scale * p.camera.y  * height/2));
    p.screen.w     = Math.round(             (p.screen.scale * roadWidth   * width/2));
  },

  overlap(x1, w1, x2, w2, percent) {
    var half = (percent || 1)/2;
    var min1 = x1 - (w1 * half);
    var max1 = x1 + (w1 * half);
    var min2 = x2 - (w2 * half);
    var max2 = x2 + (w2 * half);
    return ! ((max1 < min2) || (min1 > max2));
  }

};

//=====================================================================
// POLYFILL for requestAnimationFrame
//=====================================================================

if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
                                 window.mozRequestAnimationFrame    ||
                                 window.oRequestAnimationFrame      ||
                                 window.msRequestAnimationFrame     ||
                                 function(callback, element) {
                                   window.setTimeout(callback, 1000 / 60);
                                 };
}

//=====================================================================
// GAME LOOP helpers
//=====================================================================

const Game = {

  run(options) {

    Game.loadImages(options.images, (images) => {

      options.ready(images); // tell caller to initialize itself because images are loaded and we're ready to rumble
      Game.setKeyListener(options.keys);

      var canvas = options.canvas,    // canvas render target is provided by caller
          update = options.update,    // method to update game logic is provided by caller
          render = options.render,    // method to render the game is provided by caller
          step   = options.step,      // fixed frame step (1/fps) is specified by caller
          stats  = options.stats,     // stats instance is provided by caller
          now    = null,
          last   = Util.timestamp(),
          dt     = 0,
          gdt    = 0;

      function frame() {
        now = Util.timestamp();
        dt  = Math.min(1, (now - last) / 1000); // using requestAnimationFrame have to be able to handle large delta's caused when it 'hibernates' in a background or non-visible tab
        gdt = gdt + dt;
        while (gdt > step) {
          gdt = gdt - step;
          update(step);
        }
        render();
        last = now;
        requestAnimationFrame(frame, canvas);
      }
      frame(); // lets get this party started
      Game.playMusic();
    });
  },

  //------------------------------------------------------------------
  // load multiple images and callback when ALL images have loaded
  loadImages(names, callback) {
    var result = [];
    var count  = names.length;

    var onload = function() {
      if (--count === 0) {
        callback(result);
      }
    };

    for(var n = 0 ; n < names.length ; n++) {
      var name = names[n];
      result[n] = document.createElement('img');
      Dom.on(result[n], 'load', onload);
      result[n].src = "images/" + name + ".png";
    }
  },

  //------------------------------------------------------------------

  setKeyListener(keys) {
    var onkey = (keyCode, mode) => {
      var n, k;
      for(n = 0 ; n < keys.length ; n++) {
        k = keys[n];
        k.mode = k.mode || 'up';
        if ((k.key === keyCode) || (k.keys && (k.keys.indexOf(keyCode) >= 0))) {
          if (k.mode === mode) {
            k.action.call();
          }
        }
      }
    };
    Dom.on(document, 'keydown', (ev) => {
      ev.preventDefault();
      onkey(ev.keyCode, 'down');
    });
    Dom.on(document, 'keyup', (ev) => { onkey(ev.keyCode, 'up');   } );
  },

  playMusic() {
    var music = Dom.get('music');
    music.loop = true;
    music.volume = 0.08;
    music.muted = (Dom.storage.muted === "true");
    music.play();
    Dom.toggleClassName('mute', 'on', music.muted);
    Dom.on('mute', 'click', () => {
      Dom.storage.muted = music.muted = !music.muted;
      Dom.toggleClassName('mute', 'on', music.muted);
    });
  }

};
