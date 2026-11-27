/* Bolle di sapone in WebGL, su un canvas trasparente sopra i colori pieni.
   Tecnica ripresa e migliorata dal mockup C:
   - colore da interferenza a film sottile (acqua e sapone, n=1.33) su tre lunghezze d'onda,
     spessore che scorre (fbm con domain warping) e si assottiglia in alto per il drenaggio;
   - Fresnel con un minimo, perche' il colore resti visibile anche al centro;
   - due riflessi di finestra e un bordo sottile;
   - scoppio: anello di goccioline e pellicola che si strappa.
   Il canvas e' premoltiplicato: sopra il colore pieno la bolla schiarisce e si colora, non lo copre. */
(function () {
  'use strict';
  var MAXB = 20;
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 uSize; uniform float uDpr,uTime,uSat,uFr0,uGain; uniform vec3 uRoom;',
    'uniform vec4 uB[' + MAXB + ']; uniform vec4 uB2[' + MAXB + ']; uniform int uN;',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*n2(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'vec3 film(float tnm,float c){vec3 lam=vec3(650.,532.,450.);',
    ' float ct=sqrt(1.-(1.-c*c)/1.769); vec3 ph=12.566*1.33*tnm*ct/lam; return .5-.5*cos(ph);}',
    'void main(){',
    ' vec2 p=vec2(gl_FragCoord.x,uSize.y*uDpr-gl_FragCoord.y)/uDpr;',
    ' vec3 add=vec3(0.); float al=0.; float t=uTime;',
    ' for(int i=0;i<' + MAXB + ';i++){ if(i>=uN) break;',
    '  vec4 b=uB[i]; float pp=uB2[i].x;',
    '  vec2 q=(p-b.xy)/b.z; float lq=dot(q,q);',
    '  if(lq>(pp>0.?3.4:1.1)) continue;',
    '  float ang=atan(q.y,q.x);',
    '  float wob=1.+.02*sin(ang*2.+t*1.6+b.w*6.)+.011*sin(ang*3.-t*2.1+b.w*3.);',
    '  float d=sqrt(lq)/wob;',
    '  if(pp>0.){',
    '   float sec=floor((ang+3.1416)/6.2832*26.); float ca=(sec+.5)/26.*6.2832-3.1416;',
    '   float jr=1.+pp*(.45+.35*h21(vec2(sec,b.w)));',
    '   float dd=length(q-vec2(cos(ca),sin(ca))*jr)*b.z;',
    '   float sp=smoothstep(1.7,.3,dd)*(1.-pp)*.8*step(.35,h21(vec2(b.w,sec)));',
    '   add+=vec3(sp); al=max(al,sp);',
    '  }',
    '  if(d>1.02) continue;',
    '  float z=sqrt(max(1.-d*d,0.)); float c=max(z,.02);',
    '  vec2 sw=q*1.15+vec2(b.w*7.,b.w*3.);',
    '  sw+=.6*vec2(fbm(sw+t*.08),fbm(sw.yx-t*.06));',
    '  float h=fbm(sw*1.5+vec2(0.,t*.05));',
    '  float tn=mix(110.,780.,h)*(.55+.6*smoothstep(-1.,1.,q.y));',
    '  tn*=1.-.6*smoothstep(-.25,-1.,q.y)*(.55+.45*n2(q*4.+t*.25));',
    '  vec3 fc=film(tn,c); fc=clamp(mix(vec3(dot(fc,vec3(.3333))),fc,uSat),0.,1.);',
    '  float fr=uFr0+(1.-uFr0)*pow(1.-c,2.4);',
    '  vec2 w=mat2(.97,.24,-.24,.97)*(q-vec2(-.38,-.42)); w.y+=w.x*w.x*.9;',
    '  float win=smoothstep(.2,.06,abs(w.x))*smoothstep(.09,.02,abs(w.y));',
    '  float win2=smoothstep(.12,.0,length((q-vec2(.47,.5))*vec2(1.,1.8)));',
    '  float rim=smoothstep(.9,.985,d)*smoothstep(1.015,.985,d);',
    '  float alive=1.;',
    '  if(pp>0.){ float br=n2(vec2(ang*2.4,b.w*9.)+vec2(0.,pp*2.)); alive=step(pp*1.3,br*.95); }',
    '  float fade=smoothstep(1.02,.99,d)*alive;',
    '  vec3 R=clamp(fc*(fr*1.2+rim*.5),0.,1.)*fade*uGain;',
    '  float hl=(win*.95+win2*.35)*fade;',
    '  float edge=smoothstep(.95,.993,d)*smoothstep(1.02,.997,d)*fade;',
    '  vec3 lit=R*uRoom+vec3(hl);',
    '  float a=clamp(max(max(R.r,R.g),R.b)*.85+hl+edge*.16,0.,1.);',
    '  add=add*(1.-a)+lit; al=al+a*(1.-al);',
    ' }',
    ' gl_FragColor=vec4(min(add,vec3(al)),al);',
    '}'
  ].join('\n');

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function Field(root, opt) {
    this.root = root; this.opt = opt || {};
    this.canvas = root.querySelector('canvas.bolle-gl');
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { this.setup(); this.ok = true; } catch (e) { this.ok = false; }
  }
  Field.prototype.setup = function () {
    var gl = this.canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(pr);
    var bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var u = {}; ['uSize', 'uDpr', 'uTime', 'uSat', 'uFr0', 'uGain', 'uRoom', 'uB', 'uB2', 'uN'].forEach(function (n) { u[n] = gl.getUniformLocation(pr, n); });
    this.u = u;
    var room = this.opt.room || [1, 1, 1];
    gl.uniform3f(u.uRoom, room[0], room[1], room[2]);
    gl.uniform1f(u.uSat, this.opt.sat || 2.2); gl.uniform1f(u.uFr0, this.opt.fr0 == null ? .07 : this.opt.fr0); gl.uniform1f(u.uGain, this.opt.gain || 1);
    gl.clearColor(0, 0, 0, 0);
    this.bA = new Float32Array(MAXB * 4); this.bB = new Float32Array(MAXB * 4);
    this.bubbles = []; this.t = 0; this.lift = 0; this.running = false; this.visible = true; this.wind = null;
    var self = this;
    this.resize();
    new ResizeObserver(function () { clearTimeout(self._rt); self._rt = setTimeout(function () { self.resize(); }, 140); }).observe(this.root);
    if (!this.reduce) {
      new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; self.kick(); }, { rootMargin: '60px' }).observe(this.root);
      document.addEventListener('visibilitychange', function () { self.kick(); });
      this.bindPointer();
    }
  };
  Field.prototype.resize = function () {
    var r = this.root.getBoundingClientRect(), W = Math.round(r.width), H = Math.round(r.height);
    if (!W || !H) return;
    var resized = W !== this.W;
    this.W = W; this.H = H; this.mobile = W < 760;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 2 : 1.5) * (this.q || 1);
    this.canvas.width = Math.round(W * this.dpr); this.canvas.height = Math.round(H * this.dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    var mx = this.opt.max || [8, 12]; this.maxBubbles = this.mobile ? mx[0] : mx[1];
    if (!this.opt.nospawn && (resized || !this.bubbles.length)) this.seed();
    if (this.reduce) { this.t = 6; this.draw(); } else { this.draw(); this.kick(); }
  };
  Field.prototype.mk = function (x, y, r) {
    return { x: x, y: y, r: r, vx: 0, vy: -rnd(10, 18) * (r > 50 ? .6 : 1), ph: rnd(0, 6.28), seed: Math.random(), pop: 0, wob: rnd(.35, .9) };
  };
  /* bolle sparse; con "entrata" partono da sotto e salgono insieme */
  Field.prototype.seed = function () {
    var W = this.W, H = this.H, B = this.bubbles = [], s = this.mobile ? 1 : 1.35, sc = this.opt.scale || 1;
    var plan = this.opt.plan || [[.86, .30, 24], [.10, .46, 14], [.78, .58, 40], [.20, .74, 30], [.56, .40, 11], [.92, .82, 18], [.40, .90, 16], [.66, .16, 13], [.04, .20, 20], [.30, .30, 9], [.52, .70, 22], [.74, .92, 12]];
    for (var i = 0; i < Math.min(plan.length, this.maxBubbles); i++) {
      var p = plan[i], b = this.mk(W * p[0], H * p[1], p[2] * s * sc);
      if (this.opt.entrata && !this.reduce) { b.y += H * .55 + rnd(0, H * .25); b.vy = -rnd(160, 240); b.boost = true; }
      B.push(b);
    }
  };
  Field.prototype.spawn = function () {
    var s = this.mobile ? 1 : 1.35, sc = this.opt.scale || 1, big = Math.random() < .15;
    var r = (big ? rnd(34, 48) : (Math.random() < .5 ? rnd(7, 14) : rnd(16, 28))) * s * sc;
    return this.mk(rnd(this.W * .04, this.W * .96), this.H + r + rnd(10, 120), r);
  };
  Field.prototype.bindPointer = function () {
    var self = this;
    this.root.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a,button')) return;
      var r = self.root.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, hit = null;
      self.bubbles.forEach(function (b) { if (!b.pop && Math.hypot(b.x - x, b.y - y) < b.r + 14) hit = b; });
      if (hit) hit.pop = .001;
      else for (var k = 0; k < 3; k++) { var nb = self.mk(x + rnd(-16, 16), y + rnd(-10, 10), rnd(8, 24)); nb.vy = -rnd(40, 70); nb.vx = rnd(-24, 24); self.add(nb); }
      self.kick();
    });
    this.root.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = self.root.getBoundingClientRect(); self.wind = { x: e.clientX - r.left, y: e.clientY - r.top, t: self.t };
    });
  };
  Field.prototype.add = function (b) {
    if (this.bubbles.length >= MAXB) { for (var i = 0; i < this.bubbles.length; i++) if (!this.bubbles[i].pop && this.bubbles[i].r < 30) { this.bubbles.splice(i, 1); break; } }
    if (this.bubbles.length < MAXB) this.bubbles.push(b);
  };
  Field.prototype.kick = function () {
    if (this.reduce || !this.ok) return;
    if (this.visible && !document.hidden && !this.running) {
      this.running = true; this.prev = performance.now(); this._mark = this.prev; this.frames = 0;
      var self = this; requestAnimationFrame(function (t) { self.loop(t); });
    }
  };
  Field.prototype.loop = function (now) {
    if (!this.visible || document.hidden) { this.running = false; return; }
    var dt = Math.min((now - this.prev) / 1000, 1 / 20); this.prev = now;
    this.step(dt); this.draw(); this.frames++;
    if (now - this._mark >= 1000) {
      this.fps = Math.round(this.frames * 1000 / (now - this._mark));
      if (this.fps < 45 && this.t > 3 && this.dpr > 1.05) { this.q = (this.q || 1) * .8; this.resize(); }
      this.frames = 0; this._mark = now;
    }
    var self = this; requestAnimationFrame(function (t) { self.loop(t); });
  };
  Field.prototype.step = function (dt) {
    this.t += dt;
    var B = this.bubbles, i, j, w = this.wind;
    for (i = B.length - 1; i >= 0; i--) {
      var q = B[i];
      if (q.pop) { q.pop += dt / .22; if (q.pop >= 1) B.splice(i, 1); continue; }
      if (q.still) continue;
      var target = -(q.r > 40 ? 10 : 16) - this.lift;
      q.vy += (target - q.vy) * dt * (q.boost ? 1.6 : .5);
      if (q.boost && q.vy > -40) q.boost = false;
      q.vx *= 1 - dt * .8;
      if (w && this.t - w.t < .25) {
        var dx = q.x - w.x, dy = q.y - w.y, dd = Math.hypot(dx, dy), R = q.r + 90;
        if (dd < R && dd > 1) { var f = (1 - dd / R) * 160 * dt; q.vx += dx / dd * f; q.vy += dy / dd * f; }
      }
      q.x += (q.vx + Math.sin(this.t * q.wob + q.ph) * 10) * dt; q.y += q.vy * dt;
      if (q.y < -q.r * 1.3 || q.x < -q.r * 2 || q.x > this.W + q.r * 2) B[i] = this.spawn();
    }
    for (i = 0; i < B.length; i++) for (j = i + 1; j < B.length; j++) {
      var a = B[i], b = B[j]; if (a.pop || b.pop) continue;
      var ex = b.x - a.x, ey = b.y - a.y, e = Math.hypot(ex, ey), min = a.r + b.r;
      if (e < min && e > .01) { var k = (min - e) / e * .5 * Math.min(1, dt * 6); a.x -= ex * k; a.y -= ey * k; b.x += ex * k; b.y += ey * k; }
    }
    if (this.opt.nospawn) return;
    var live = 0; for (i = 0; i < B.length; i++) if (!B[i].pop) live++;
    if (live < this.maxBubbles && (!this._sp || this.t - this._sp > .5)) { this._sp = this.t; B.push(this.spawn()); }
  };
  Field.prototype.draw = function () {
    var gl = this.gl, u = this.u, B = this.bubbles, n = Math.min(B.length, MAXB);
    for (var i = 0; i < n; i++) {
      var b = B[i];
      this.bA[i * 4] = b.x; this.bA[i * 4 + 1] = b.y; this.bA[i * 4 + 2] = b.r; this.bA[i * 4 + 3] = b.seed;
      this.bB[i * 4] = b.pop || 0;
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uSize, this.W, this.H); gl.uniform1f(u.uDpr, this.dpr); gl.uniform1f(u.uTime, this.t);
    gl.uniform4fv(u.uB, this.bA); gl.uniform4fv(u.uB2, this.bB); gl.uniform1i(u.uN, n);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  Field.prototype.stop = function () { this.visible = false; };
  Field.prototype.setLift = function (v) { this.lift = Math.min(60, Math.abs(v || 0) * .04); };
  Field.prototype.advance = function (sec) { for (var k = 0; k < sec * 60; k++) this.step(1 / 60); this.draw(); };

  window.Bolle = { Field: Field };
})();
