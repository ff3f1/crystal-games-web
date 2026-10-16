"use strict";
/* ===== WebGL-рендер: фон планеты, частицы со свечением, крупные фигуры ===== */

const Render = (function () {
  let cv, gl, W = 0, H = 0, dpr = 1, ok = false;
  let progBg, progPt, progQuad, progBlur, progComp;
  let bufQuadFull, bufPt, bufQ;
  let texFloor = null, texNeb = null;
  let fboA, fboB, gw = 0, gh = 0;
  let quality = 2;            // 0 — низкое, 1 — среднее, 2 — высокое
  const MAXP = 14000;
  const pt = new Float32Array(MAXP * 7);   // x y size r g b a
  let np = 0;
  const MAXQ = 600;
  const qd = new Float32Array(MAXQ * 6 * 10); // x y u v r g b a kind param
  let nq = 0;
  const cam = { x: 0, y: 0, scale: 1 };
  let bgParams = { R: 2000, edge: [0.4, 0.9, 1], tint: [0, 0, 0], dark: 0, lightR: 0, lx: 0, ly: 0, t: 0 };

  const VS_FULL = `attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}`;

  const FS_BG = `precision mediump float;varying vec2 v;
uniform vec2 res;uniform vec3 cam;uniform float R;uniform sampler2D floorT;uniform sampler2D neb;
uniform vec3 edge;uniform float t;uniform float dark;uniform vec3 light;
void main(){
  vec2 fc=v*res; vec2 w=cam.xy+(fc-res*0.5)/cam.z*vec2(1.,-1.);
  vec3 nb=texture2D(neb,(cam.xy*0.25+(fc-res*0.5)/cam.z*0.6*vec2(1.,-1.))/2600.+0.5).rgb;
  vec3 col=nb;
  float d=length(w);
  vec2 uv=w/(2.*R)+0.5;
  if(d<R){vec3 f=texture2D(floorT,uv).rgb; col=nb*0.55+f;}
  else {col*=0.45;}
  float e=abs(d-R);
  col+=edge*(exp(-e*0.02)*0.55+exp(-e*0.15)*0.9)*(0.85+0.15*sin(t*2.+atan(w.y,w.x)*12.));
  if(dark>0.){float ld=length(w-light.xy);float vis=clamp(1.-ld/light.z,0.,1.);vis=vis*vis;col*=mix(1.,0.08+vis*0.92,dark);}
  vec2 q=v-0.5; col*=1.-dot(q,q)*0.9;
  gl_FragColor=vec4(col,1.);
}`;

  const VS_PT = `attribute vec2 p;attribute float s;attribute vec4 c;
uniform vec3 cam;uniform vec2 res;uniform float pxs;uniform float smul;varying vec4 vc;
void main(){vec2 sp=(p-cam.xy)*cam.z;gl_Position=vec4(sp/(res*0.5)*vec2(1.,-1.),0.,1.);
float ps=s*cam.z*pxs*smul;gl_PointSize=clamp(ps,1.5,120.);
vc=c;if(ps<1.5)vc.a*=ps/1.5;}`;
  const FS_PT = `precision mediump float;varying vec4 vc;
void main(){vec2 q=gl_PointCoord-0.5;float d=dot(q,q)*4.;float a=exp(-d*3.2)+exp(-d*14.)*0.8;
gl_FragColor=vec4(vc.rgb*vc.a*a,1.);}`;

  const VS_Q = `attribute vec2 p;attribute vec2 uv;attribute vec4 c;attribute vec2 k;
uniform vec3 cam;uniform vec2 res;varying vec2 vu;varying vec4 vc;varying vec2 vk;
void main(){vec2 sp=(p-cam.xy)*cam.z;gl_Position=vec4(sp/(res*0.5)*vec2(1.,-1.),0.,1.);vu=uv;vc=c;vk=k;}`;
  const FS_Q = `precision mediump float;varying vec2 vu;varying vec4 vc;varying vec2 vk;
void main(){float d=length(vu);float a=0.;
if(vk.x<0.5){a=exp(-d*d*4.);}
else if(vk.x<1.5){float th=vk.y;a=exp(-pow((d-(1.-th))/th,2.)*3.);}
else if(vk.x<2.5){a=smoothstep(1.,0.92,d)*0.35+exp(-pow((d-0.95)/0.04,2.))*0.9;}
else {float ang=atan(vu.y,vu.x)/6.2831853+0.5;float th=0.12;float ring=exp(-pow((d-0.88)/th,2.)*3.);a=ring*step(ang,vk.y)+ring*0.18;}
if(d>1.)a=0.;gl_FragColor=vec4(vc.rgb*vc.a*a,1.);}`;

  const FS_BLUR = `precision mediump float;varying vec2 v;uniform sampler2D tx;uniform vec2 dir;
void main(){vec3 s=texture2D(tx,v).rgb*0.227;
s+=(texture2D(tx,v+dir*1.38).rgb+texture2D(tx,v-dir*1.38).rgb)*0.316;
s+=(texture2D(tx,v+dir*3.23).rgb+texture2D(tx,v-dir*3.23).rgb)*0.07;
gl_FragColor=vec4(s,1.);}`;
  const FS_COMP = `precision mediump float;varying vec2 v;uniform sampler2D tx;uniform float k;
void main(){vec3 c=texture2D(tx,v).rgb*k;gl_FragColor=vec4(c,1.);}`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function prog(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; p.a = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const n = gl.getActiveUniform(p, i).name; p.u[n] = gl.getUniformLocation(p, n); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const n = gl.getActiveAttrib(p, i).name; p.a[n] = gl.getAttribLocation(p, n); }
    return p;
  }
  function mkFbo(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { f, t, w, h };
  }
  function texFromCanvas(c, old, wrap) {
    if (old) gl.deleteTexture(old);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wm = wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wm);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wm);
    return t;
  }

  function init(canvas) {
    cv = canvas;
    try {
      gl = cv.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" })
        || cv.getContext("experimental-webgl");
      if (!gl) return false;
      progBg = prog(VS_FULL, FS_BG);
      progPt = prog(VS_PT, FS_PT);
      progQuad = prog(VS_Q, FS_Q);
      progBlur = prog(VS_FULL, FS_BLUR);
      progComp = prog(VS_FULL, FS_COMP);
      bufQuadFull = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufQuadFull);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      bufPt = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufPt);
      gl.bufferData(gl.ARRAY_BUFFER, pt.byteLength, gl.DYNAMIC_DRAW);
      bufQ = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufQ);
      gl.bufferData(gl.ARRAY_BUFFER, qd.byteLength, gl.DYNAMIC_DRAW);
      cv.addEventListener("webglcontextlost", e => { e.preventDefault(); ok = false; }, false);
      ok = true;
      resize();
      return true;
    } catch (e) { console.warn("WebGL", e); ok = false; return false; }
  }

  function resize() {
    if (!gl) return;
    const cap = quality === 0 ? 1 : quality === 1 ? 1.5 : 2;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    W = Math.max(2, Math.round(cv.clientWidth * dpr)); H = Math.max(2, Math.round(cv.clientHeight * dpr));
    cv.width = W; cv.height = H;
    const div = quality === 0 ? 5 : 4;
    gw = Math.max(2, Math.round(W / div)); gh = Math.max(2, Math.round(H / div));
    if (fboA) { gl.deleteFramebuffer(fboA.f); gl.deleteTexture(fboA.t); gl.deleteFramebuffer(fboB.f); gl.deleteTexture(fboB.t); }
    fboA = mkFbo(gw, gh); fboB = mkFbo(gw, gh);
  }
  function setQuality(q) { quality = q; resize(); }

  function setTextures(floorCanvas, nebCanvas) {
    if (!ok) return;
    texFloor = texFromCanvas(floorCanvas, texFloor, false);
    if (nebCanvas) texNeb = texFromCanvas(nebCanvas, texNeb, true);
  }

  function begin() { np = 0; nq = 0; }
  function point(x, y, s, r, g, b, a) {
    if (np >= MAXP) return; const o = np * 7;
    pt[o] = x; pt[o + 1] = y; pt[o + 2] = s; pt[o + 3] = r; pt[o + 4] = g; pt[o + 5] = b; pt[o + 6] = a; np++;
  }
  // kind: 0 — мягкое пятно, 1 — кольцо (param — толщина 0..1), 2 — зона с ободом, 3 — кольцо прогресса (param 0..1)
  function quad(x, y, rad, r, g, b, a, kind, param) {
    if (nq >= MAXQ) return; let o = nq * 60;
    const V = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]];
    for (let i = 0; i < 6; i++) {
      const u = V[i][0], v = V[i][1];
      qd[o++] = x + u * rad; qd[o++] = y + v * rad; qd[o++] = u; qd[o++] = v;
      qd[o++] = r; qd[o++] = g; qd[o++] = b; qd[o++] = a; qd[o++] = kind; qd[o++] = param || 0;
    }
    nq++;
  }

  function attrib(p, name, size, stride, off) {
    const l = p.a[name]; if (l == null || l < 0) return;
    gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, stride, off);
  }
  function disableAttribs() { for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i); }

  function drawFull(p) {
    gl.bindBuffer(gl.ARRAY_BUFFER, bufQuadFull);
    disableAttribs(); attrib(p, "p", 2, 8, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function drawPoints(w, h, smul, pxs) {
    gl.useProgram(progPt);
    gl.uniform3f(progPt.u.cam, cam.x, cam.y, cam.scale * dpr * (w / W));
    gl.uniform2f(progPt.u.res, w, h);
    gl.uniform1f(progPt.u.pxs, pxs);
    gl.uniform1f(progPt.u.smul, smul);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPt);
    disableAttribs(); attrib(progPt, "p", 2, 28, 0); attrib(progPt, "s", 1, 28, 8); attrib(progPt, "c", 4, 28, 12);
    gl.drawArrays(gl.POINTS, 0, np);
  }
  function drawQuads(w, h) {
    if (!nq) return;
    gl.useProgram(progQuad);
    gl.uniform3f(progQuad.u.cam, cam.x, cam.y, cam.scale * dpr * (w / W));
    gl.uniform2f(progQuad.u.res, w, h);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufQ);
    disableAttribs(); attrib(progQuad, "p", 2, 40, 0); attrib(progQuad, "uv", 2, 40, 8); attrib(progQuad, "c", 4, 40, 16); attrib(progQuad, "k", 2, 40, 32);
    gl.drawArrays(gl.TRIANGLES, 0, nq * 6);
  }

  function end() {
    if (!ok) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPt); gl.bufferSubData(gl.ARRAY_BUFFER, 0, pt.subarray(0, np * 7));
    if (nq) { gl.bindBuffer(gl.ARRAY_BUFFER, bufQ); gl.bufferSubData(gl.ARRAY_BUFFER, 0, qd.subarray(0, nq * 60)); }

    const bloom = quality > 0 || true;
    // 1) свечение в маленький буфер
    if (bloom) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.f); gl.viewport(0, 0, gw, gh);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      drawQuads(gw, gh);
      drawPoints(gw, gh, 2.6, 1);
      gl.disable(gl.BLEND);
      const passes = quality === 2 ? 2 : 1;
      gl.useProgram(progBlur); gl.uniform1i(progBlur.u.tx, 0); gl.activeTexture(gl.TEXTURE0);
      for (let i = 0; i < passes; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.f); gl.bindTexture(gl.TEXTURE_2D, fboA.t);
        gl.uniform2f(progBlur.u.dir, (1 + i) / gw, 0); drawFull(progBlur);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.f); gl.bindTexture(gl.TEXTURE_2D, fboB.t);
        gl.uniform2f(progBlur.u.dir, 0, (1 + i) / gh); drawFull(progBlur);
      }
    }
    // 2) фон
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    if (texFloor) {
      gl.useProgram(progBg);
      gl.uniform2f(progBg.u.res, W, H);
      gl.uniform3f(progBg.u.cam, cam.x, cam.y, cam.scale * dpr);
      gl.uniform1f(progBg.u.R, bgParams.R);
      gl.uniform3f(progBg.u.edge, bgParams.edge[0], bgParams.edge[1], bgParams.edge[2]);
      gl.uniform1f(progBg.u.t, bgParams.t);
      gl.uniform1f(progBg.u.dark, bgParams.dark);
      gl.uniform3f(progBg.u.light, bgParams.lx, bgParams.ly, bgParams.lightR);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texFloor); gl.uniform1i(progBg.u.floorT, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texNeb); gl.uniform1i(progBg.u.neb, 1);
      gl.activeTexture(gl.TEXTURE0);
      drawFull(progBg);
    } else { gl.clearColor(0.02, 0.02, 0.06, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    // 3) фигуры и частицы
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    drawQuads(W, H);
    drawPoints(W, H, 1, 1);
    // 4) свечение поверх
    if (bloom) {
      gl.useProgram(progComp); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboA.t);
      gl.uniform1i(progComp.u.tx, 0); gl.uniform1f(progComp.u.k, quality === 0 ? 0.75 : 0.9);
      drawFull(progComp);
    }
    gl.disable(gl.BLEND);
  }

  return {
    init, resize, setQuality, setTextures, begin, point, quad, end, cam, bg: bgParams,
    get ok() { return ok; }, get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
    get quality() { return quality; }, get count() { return np; }
  };
})();
