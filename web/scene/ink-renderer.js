import {channels, dot, transformPoint} from './ink-mesh.js';

const projection = `
uniform vec3 uRight,uUp,uEye,uCenter,uOrigin,uObjectScale,uTint;
uniform vec2 uTurn,uSize;
uniform float uScale,uLevel,uPose,uVoice,uTintAmount,uOpacity,uDrawing,uSweep,uWobble;
attribute vec3 aPoint,aColour;
varying mediump vec3 vColour;
vec3 world(vec3 p) {
  p *= uObjectScale;
  if (uVoice == 1.0) p.x += uPose * 0.13 * smoothstep(0.16,3.06,p.y);
  if (uVoice == 2.0) p.z += uPose * 0.075 * p.y;
  if (uVoice == 3.0) p.y += uPose * 0.095 * smoothstep(1.3,2.2,p.y);
  return vec3(uTurn.x*p.x+uTurn.y*p.z,p.y,-uTurn.y*p.x+uTurn.x*p.z)+uOrigin;
}
vec3 project(vec3 p) {
  p -= uCenter;
  return vec3(vec2(dot(p,uRight),dot(p,uUp))*2.0*uScale/uSize,-dot(p,uEye)/256.0);
}
`;

const surfaceVertex = `
varying mediump float vX;
void main() {
  vec3 p = world(aPoint);
  vX = p.x;
  vColour = mix(aColour,uTint,uTintAmount);
  gl_Position = vec4(project(p),1.0);
}`;
const surfaceFragment = `
precision mediump float;
uniform float uSweep,uOpacity;
varying mediump vec3 vColour;
varying mediump float vX;
void main() {
  float d = abs(vX-uSweep);
  float band = exp(-d*8.0)*0.025 + (1.0-smoothstep(0.002,0.027,d))*0.22;
  gl_FragColor = vec4(vColour+band*vec3(0.82,0.99,0.48),uOpacity);
}`;

const inkVertex = `
attribute vec3 aTangent;
attribute float aSide,aWidth;
varying mediump float vAcross,vHalf;
void main() {
  vec3 p = world(aPoint);
  vec3 at = project(p);
  vec2 t = (project(world(aPoint+0.025*aTangent)).xy-at.xy)*uSize;
  vec2 normal = vec2(-t.y,t.x)/max(length(t),0.0001);
  vHalf = 0.5*aWidth*(0.97+0.10*sin(dot(p,vec3(2.3,4.5,-1.9)))+0.17*uLevel);
  vAcross = aSide*(vHalf+0.68);
  float a = dot(p,vec3(5.7,7.1,4.9)), b = dot(p,vec3(-7.6,4.2,6.3));
  vec2 wobble = 0.64*vec2(sin(a+uDrawing),sin(b-1.3*uDrawing))
              + 0.36*vec2(sin(2.6*b-0.8*uDrawing),sin(2.3*a+1.7*uDrawing));
  wobble *= uWobble*(uVoice < 0.5 ? 0.43 : 1.0);
  gl_Position = vec4(at.xy+2.0*(wobble+normal*vAcross)/uSize,at.z-0.00008,1.0);
  vColour = mix(aColour,uTint,uTintAmount)*(1.0+0.35*uLevel);
}`;

const inkFragment = `
precision mediump float;
uniform float uOpacity;
varying mediump vec3 vColour;
varying mediump float vAcross,vHalf;
void main() {
  float cover = 1.0-smoothstep(vHalf-0.56,vHalf+0.56,abs(vAcross));
  gl_FragColor = vec4(vColour,uOpacity*cover);
}`;

const uniforms = ['Right','Up','Eye','Center','Origin','ObjectScale','Tint','Turn','Size',
  'Scale','Level','Pose','Voice','TintAmount','Opacity','Drawing','Sweep','Wobble'];

class InkProgram {
  constructor(gl, vertex, fragment, fields) {
    this.gl = gl;
    const program = gl.createProgram();
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    };
    compile(gl.VERTEX_SHADER, 'precision highp float;\n' + projection + vertex);
    compile(gl.FRAGMENT_SHADER, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program;
    this.fields = fields.map(([name, size]) => [gl.getAttribLocation(program, 'a' + name), size]);
    this.stride = fields.reduce((sum, [, size]) => sum + size, 0);
    this.u = Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program, 'u' + name)]));
  }

  begin(camera, frame) {
    const {gl, u} = this;
    gl.useProgram(this.program);
    for (const [location] of this.fields) gl.enableVertexAttribArray(location);
    gl.uniform3fv(u.Right, camera.right);
    gl.uniform3fv(u.Up, camera.up);
    gl.uniform3fv(u.Eye, camera.eye);
    gl.uniform3fv(u.Center, camera.center);
    gl.uniform2f(u.Size, camera.width, camera.height);
    gl.uniform1f(u.Scale, camera.scale);
    gl.uniform1f(u.Drawing, frame.drawing);
    this.frame = frame;
  }

  draw(buffer, count, item) {
    if (!count) return;
    const {gl, u} = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    let offset = 0;
    for (const [location, size] of this.fields) {
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 4 * this.stride, 4 * offset);
      offset += size;
    }
    gl.uniform3fv(u.Origin, item.origin);
    gl.uniform3fv(u.ObjectScale, item.scale);
    gl.uniform3fv(u.Tint, item.tint);
    gl.uniform2fv(u.Turn, item.turn);
    gl.uniform1f(u.Level, item.level);
    gl.uniform1f(u.Pose, item.pose * item.level);
    gl.uniform1f(u.Voice, item.voice);
    gl.uniform1f(u.TintAmount, item.tintAmount);
    gl.uniform1f(u.Opacity, item.opacity);
    gl.uniform1f(u.Wobble, this.frame.wobble * item.wobble);
    gl.uniform1f(u.Sweep, item.catchesSweep ? (this.frame.sweepX ?? 30000) : 30000);
    gl.drawArrays(gl.TRIANGLES, 0, count / this.stride);
  }

  end() {
    for (const [location] of this.fields) this.gl.disableVertexAttribArray(location);
  }
}

export class WebInkRenderer {
  buffers = new Map();

  constructor(gl) {
    this.gl = gl;
    const fields = [['Point', 3], ['Colour', 3]];
    this.surface = new InkProgram(gl, surfaceVertex, surfaceFragment, fields);
    this.ink = new InkProgram(gl, inkVertex, inkFragment, [...fields, ['Tangent', 3], ['Side', 1], ['Width', 1]]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0, 0, 0, 0);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  draw(canvas, camera, items, frame) {
    const {gl} = this;
    const visible = new Set(items.map(item => item.mesh));
    for (const [mesh, buffers] of this.buffers) {
      if (visible.has(mesh) || mesh.model) continue;
      buffers.forEach(buffer => gl.deleteBuffer(buffer));
      this.buffers.delete(mesh);
    }
    for (const mesh of visible) {
      if (this.buffers.has(mesh)) continue;
      this.buffers.set(mesh, [mesh.surfaces, mesh.strokes].map(data => {
        if (!data.length) return null;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        return buffer;
      }));
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.surface.begin(camera, frame);
    for (const item of items) {
      if (item.opacity === 1) this.surface.draw(this.buffers.get(item.mesh)[0], item.mesh.surfaces.length, item);
    }
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    const ghosts = items.filter(item => item.opacity < 1).sort((a, b) => dot(a.origin, camera.eye) - dot(b.origin, camera.eye));
    for (const item of ghosts) this.surface.draw(this.buffers.get(item.mesh)[0], item.mesh.surfaces.length, item);
    this.surface.end();
    this.ink.begin(camera, frame);
    for (const item of items) this.ink.draw(this.buffers.get(item.mesh)[1], item.mesh.strokes.length, item);
    this.ink.end();
  }
}

export class CanvasInkRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(canvas, camera, items, frame) {
    const {ctx} = this;
    ctx.setTransform(canvas.width / camera.width, 0, 0, canvas.height / camera.height, 0, 0);
    ctx.clearRect(0, 0, camera.width, camera.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const commands = items.flatMap(item => item.mesh.commands.map(command => {
      const points = command.points.map(point => transformPoint(point, item));
      const depth = points.reduce((sum, point) => sum + dot(point, camera.eye), 0) / points.length;
      const layer = item.canvasLayer === undefined ? 4 : item.canvasLayer + (command.width ? 1 : 0);
      return {points, depth: depth + (command.width ? 0.02 : 0), layer, command, item};
    })).sort((a, b) => a.layer - b.layer || a.depth - b.depth);
    for (const {points, command, item} of commands) {
      ctx.beginPath();
      points.forEach((point, i) => {
        const screen = camera.project(point);
        if (command.width) {
          const a = dot(point, [5.7, 7.1, 4.9]);
          const b = dot(point, [-7.6, 4.2, 6.3]);
          const d = frame.drawing;
          const wobble = (item.voice ? 1 : 0.43) * frame.wobble * item.wobble;
          screen.x += wobble * (0.64 * Math.sin(a + d) + 0.36 * Math.sin(2.6 * b - 0.8 * d));
          screen.y -= wobble * (0.64 * Math.sin(b - 1.3 * d) + 0.36 * Math.sin(2.3 * a + 1.7 * d));
        }
        if (i) ctx.lineTo(screen.x, screen.y);
        else ctx.moveTo(screen.x, screen.y);
      });
      const brightness = command.width ? 1 + 0.35 * item.level : 1;
      let colour = command.colour;
      if (item.tintAmount || brightness !== 1) {
        const rgb = channels(colour).map((n, i) => (n * (1 - item.tintAmount) + item.tint[i] * item.tintAmount) * brightness);
        colour = `rgb(${rgb.map(n => Math.min(255, Math.round(255 * n))).join(',')})`;
      }
      ctx.globalAlpha = item.opacity;
      if (command.width) {
        ctx.lineWidth = command.width * (1 + item.level * 0.17);
        ctx.strokeStyle = colour;
        ctx.stroke();
      } else {
        ctx.fillStyle = colour;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
