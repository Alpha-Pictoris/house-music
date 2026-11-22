import { brushFor } from './furniture-art.js';
import { InkMesh, instance } from './ink-mesh.js';
import { oval } from './domestic-art.js';

const uniforms = {
  trombone: { coat: '#642e46', braid: '#ff9e91', plume: '#ff7984' },
  drum: { coat: '#25494a', braid: '#97e6ce', plume: '#59dbb8' },
  sousaphone: { coat: '#47355d', braid: '#d5aeef', plume: '#c997ff' }
};
const seam = '#242034', brass = '#f1c67e', bone = '#fae5b5';
const models = new Map();

function band(brush, rings, fill, ink) {
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1], b = rings[i];
    for (let j = 0; j < b.length; j++) {
      const k = (j + 1) % b.length;
      brush.face([a[j], a[k], b[k], b[j]], fill);
    }
  }
  brush.face(rings.at(-1), fill);
  brush.line(rings[0], ink, 0.95, true);
  brush.line(rings.at(-1), ink, 1, true);
  for (let i = 0; i < rings[0].length; i += Math.ceil(rings[0].length / 4)) {
    brush.line(rings.map(ring => ring[i]), ink, 0.84);
  }
}

function limb(brush, joints, radii, fill, ink) {
  band(brush, joints.map(([x,y,z], i) => oval(x,y,z,radii[i],radii[i]*0.84,'xz',6)), fill, ink);
}

function legs(brush, wave, ink) {
  for (const side of [-1, 1]) {
    const swing = wave * side, knee = Math.max(0, swing);
    const x = side * 0.112, z = swing * 0.22;
    const foot = 0.04 + knee * 0.12, ankle = [x, foot + 0.13, z];
    limb(brush, [[x,0.70,0], [x + side*0.02,0.36 + knee*0.11,0.055 + 0.17*swing], ankle],
      [0.084,0.07,0.044], seam, ink);
    band(brush, [oval(x,foot,z+0.052,0.074,0.142,'xz',8),
      oval(x,ankle[1],z,0.054,0.066,'xz',8)], '#302834', '#dcbd9b');
  }
}

function jacket(brush, palette) {
  const { coat, braid } = palette;
  band(brush, [[0.61,0.24,0.15], [0.84,0.16,0.135], [1.13,0.24,0.15], [1.22,0.12,0.105]]
    .map(([y,w,d]) => oval(0,y,0,w,d,'xz',8)), coat, braid);
  for (const side of [-1, 1]) {
    brush.shape([[side*0.17,0.78,-0.11],[side*0.24,0.67,-0.13],[side*0.14,0.43,-0.18],[0,0.67,-0.14]], coat, braid, 0.9);
    brush.line([[side*0.22,1.12,0.04],[side*0.14,1.15,0.13],[0,1.09,0.16]], brass, 1);
  }
  for (const y of [0.90, 1, 1.09]) brush.line([[-0.11,y,0.145],[0,y-0.035,0.16],[0.11,y,0.145]], braid, 0.91);
}

function shako(brush, palette, wave) {
  const { braid, plume } = palette;
  band(brush, [oval(0,1.17,0,0.095,0.08,'xz',8), oval(0,1.34,0,0.145,0.123,'xz',8),
    oval(0,1.47,0,0.131,0.115,'xz',8)], '#503840', bone);
  brush.shape([[-0.13,1.39,0.070],[0,1.32,0.192],[0.13,1.39,0.070],[0.09,1.28,0.113],[0,1.22,0.16],
    [-0.09,1.28,0.113]], '#59414b', bone, 0.86);
  for (const s of [-1, 1]) brush.segment([s*0.106,1.365,0.096],[s*0.04,1.345,0.149], '#fff3bb', 1.45);
  band(brush, [oval(0,1.415,0.009,0.158,0.14,'xz',8),oval(0,1.65,-0.02,0.147,0.12,'xz',8)], seam, braid);
  brush.shape([[-0.14,1.43,0.04],[0.14,1.43,0.04],[0.13,1.415,0.18],[0,1.396,0.208],[-0.13,1.415,0.18]],seam,brass,0.94);
  const tip = 0.042 * wave;
  brush.shape([[0,1.59,0.085],[-0.07,1.76,0.055],[-0.067+tip,1.92,0.012],[tip,2.015,-0.085],
    [0.086+tip,1.86,-0.061],[0.087,1.75,0.016]],plume,braid,1.03);
  brush.line([[0,1.59,0.09],[0.025,1.78,0.065],[tip,1.975,-0.06]],bone,0.72);
}

function hornBell(brush, x, y, z, radius, length) {
  const rims = [[0,radius*0.16],[length*0.61,radius*0.4],[length,radius]].map(([dz,r]) =>
    oval(x,y+dz*0.24,z+dz,r,r,'xy',12));
  band(brush, rims, '#98693d', brass);
  brush.shape(oval(x,y+length*0.24,z+length+0.006,radius*0.86,radius*0.86,'xy',12),'#382837',bone,0.84);
}

function trombone(brush, wave) {
  const end = 0.60 + 0.14 * wave;
  brush.line([[0,1.28,0.16],[-0.07,1.25,0.23],[-0.07,1.21,end],[-0.03,1.18,end+0.06],
    [0.065,1.19,end+0.06],[0.105,1.22,end],[0.105,1.26,0.12]],brass,1.65);
  brush.segment([0.105,1.26,0.12],[0.105,1.29,0.30],bone,1.55);
  hornBell(brush,0.105,1.29,0.30,0.125,0.21);
  return [[-0.07,1.22,0.23], [0.08,1.20,end-0.09]];
}

function snare(brush, wave) {
  const drum = [oval(0,0.69,0.263,0.252,0.20,'xz',12),oval(0,0.93,0.263,0.252,0.20,'xz',12)];
  band(brush,drum,'#406962',brass);
  brush.shape(drum[1],'#b4ae8e',bone,1);
  for (let i = 0; i < 12; i += 2) {
    brush.line([drum[1][i],drum[0][(i+1)%12],drum[1][(i+2)%12]],'#c4dfba',0.86);
  }
  brush.line([[-0.16,1.13,0.10],[0.12,0.90,0.20]],bone,1.45);
  return [-1,1].map(side => {
    const hand = [side*0.245,1.05 + side*wave*0.065,0.25];
    brush.segment(hand,[side*0.054,1.055 + side*wave*0.108,0.39],bone,1.52);
    return hand;
  });
}

function sousaphone(brush) {
  for (const inset of [0,0.048]) {
    brush.line(oval(-0.035,1.03,-0.015,0.292-inset,0.344-inset,'xy',20),brass,1.7,true);
  }
  brush.line([[-0.26,1.08,0],[-0.34,1.21,0],[-0.34,1.44,0.035],[-0.28,1.52,0.105]],brass,2.1);
  hornBell(brush,-0.28,1.52,0.105,0.217,0.19);
  brush.line([[0,1.28,0.16],[0.09,1.26,0.22],[0.15,1.12,0.22],[0.08,0.99,0.14]],bone,1.35);
  return [[-0.20,1.03,0.11],[0.13,1.13,0.19]];
}

function upperBody(mesh, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const tilt = ([x,y,z]) => [x*cos - (y-0.67)*sin, 0.67 + x*sin + (y-0.67)*cos, z];
  return brushFor({
    face: (points, colour) => mesh.face(points.map(tilt), colour),
    line: (points, ...ink) => mesh.line(points.map(tilt), ...ink),
    segment: (a, b, ...ink) => mesh.segment(tilt(a), tilt(b), ...ink)
  });
}

function model(instrument, step, action) {
  const mesh = new InkMesh(0.15);
  const wave = Math.sin(step * Math.PI / 6), palette = uniforms[instrument];
  legs(brushFor(mesh), action === 'walk' ? wave : 0, palette.braid);
  const brush = upperBody(mesh, wave * (action === 'sway' ? 0.16 : 0.105));
  jacket(brush, palette);
  shako(brush, palette, wave);
  const hands = { trombone, drum: snare, sousaphone }[instrument](brush,wave);
  hands.forEach((hand, i) => {
    const side = i * 2 - 1;
    limb(brush, [[0.196*side,1.13,0], [0.265*side,0.98 + 0.045*side*wave,0.15], hand],
      [0.071,0.059,0.044],palette.coat,palette.braid);
    brush.line(oval(...hand,0.047,0.041,'xz',6),bone,1,true);
  });
  mesh.model = true;
  mesh.strokes = Float32Array.from(mesh.strokes);
  mesh.surfaces = Float32Array.from(mesh.surfaces);
  return mesh;
}

export function marcherItem({ instrument, x, z, angle, ground, action, step }) {
  const key = instrument + action + step;
  if (!models.has(key)) models.set(key, model(instrument, step, action));
  return instance(models.get(key), {
    origin: [x, ground, z],
    turn: [Math.cos(angle),Math.sin(angle)], catchesSweep: false, wobble: 1.35
  });
}
