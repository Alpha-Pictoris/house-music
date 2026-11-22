import {brushFor} from './furniture-art.js';

export const panel = (x, y, width, height, z) =>
  [[x, y, z], [x + width, y, z], [x + width, y + height, z], [x, y + height, z]];

export function oval(x, y, z, a, b, plane = 'xz', count = 24) {
  return Array.from({length: count}, (_, i) => {
    const angle = i * Math.PI * 2 / count, u = a * Math.cos(angle), v = b * Math.sin(angle);
    return plane === 'xz' ? [x + u, y, z + v] : [x + u, y + v, z];
  });
}

function cushion(brush, x, y, z, width, depth, lip, fill, ink) {
  const edge = (level, inset) => {
    const l = x - width / 2 + inset, r = x + width / 2 - inset, b = z - depth / 2 + inset, f = z + depth / 2 - inset;
    return [[l + lip,level,b],[r - lip,level,b],[r,level,b + lip],[r,level,f - lip],
      [r - lip,level,f],[l + lip,level,f],[l,level,f - lip],[l,level,b + lip]];
  };
  const base = edge(y, 0), top = edge(y + lip, lip * 0.25);
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    brush.face([base[i], base[j], top[j], top[i]], fill);
  }
  brush.shape(top, fill, ink, 0.85);
  brush.line(base, ink, 0.8, true);
}

const gold = '#e6b987';
const wood = '#3c2432';
const rose = '#d58fa6';

function sofa(brush) {
  const {box, line, segment} = brush;
  for (const x of [-1, 1]) for (const z of [-0.38, 0.41]) {
    box(x - 0.07, 0.02, z - 0.07, x + 0.07, 0.27, z + 0.07, wood, gold, 0.85);
  }
  cushion(brush, 0, 0.28, 0, 2.47, 1.16, 0.22, '#583043', rose);
  box(-1.13, 0.43, -0.6, 1.13, 1.35, -0.29, '#693b58', '#ec9caf');
  for (const x of [-0.68, 0, 0.68]) {
    cushion(brush, x, 0.49, 0.13, 0.66, 0.82, 0.11, '#8d4864', '#f5a7b9');
    line(panel(x - 0.23, 0.68, 0.46, 0.53, -0.282), rose, 0.72, true);
    line(oval(x, 0.96, -0.27, 0.046, 0.043, 'xy', 10), gold, 0.8, true);
  }
  for (const x of [-1.08, 1.08]) {
    box(x - 0.15, 0.43, -0.43, x + 0.15, 0.82, 0.53, '#62354b', rose);
    cushion(brush, x, 0.82, 0.03, 0.32, 1.06, 0.12, '#814861', '#f5a7b9');
  }
  segment([-0.91, 0.36, 0.59], [0.91, 0.36, 0.59], '#f0a4aa', 1);
}

function bed(brush) {
  const {box, shape, line, segment} = brush;
  box(-1.02, 0.17, -1.38, 1.02, 0.53, 1.38, wood, '#a681a5');
  cushion(brush, 0, 0.51, 0, 1.96, 2.68, 0.18, '#707096', '#b9c4ed');
  box(-0.99, 0.13, -1.43, 0.99, 1.28, -1.22, '#414066', '#bac8ec');
  shape([[-0.93,1.28,-1.27],[-0.72,1.47,-1.27],[0,1.68,-1.27],
    [0.72,1.47,-1.27],[0.93,1.28,-1.27]], '#55547d', '#c5cdff', 1.3);
  for (const x of [-0.93, 0.93]) for (const z of [-1.35, 1.33]) {
    box(x - 0.08, 0.02, z - 0.09, x + 0.08, z < 0 ? 1.49 : 0.89, z + 0.09, '#47436a', '#b3bae7');
  }
  for (const x of [-0.48, 0.48]) cushion(brush, x, 0.68, -0.87, 0.77, 0.64, 0.13, '#adadc6', '#e1ddf3');
  cushion(brush, 0, 0.67, 0.38, 1.96, 1.86, 0.13, '#55588b', '#b8bcec');
  for (const x of [-0.65, 0, 0.65]) {
    segment([x, 0.801, -0.44], [x, 0.801, 1.23], '#838abb', 0.85);
    for (const z of [-0.2, 0.31, 0.82]) line([[x,0.807,z-0.14],[x+0.13,0.807,z],
      [x,0.807,z+0.14],[x-0.13,0.807,z]], '#afb8df', 0.75, true);
  }
  box(-0.84, 0.30, 1.29, 0.84, 0.68, 1.42, '#454167', '#aab5e8');
}

function table(brush) {
  const {box, line, segment} = brush;
  for (const x of [-0.54, 0.54]) for (const z of [-0.33, 0.31]) {
    box(x - 0.056, 0.05, z - 0.06, x + 0.056, 0.98, z + 0.06, wood, gold, 0.9);
  }
  cushion(brush, 0, 0.93, -0.06, 1.52, 1.05, 0.11, '#70503f', '#eabb8f');
  for (const x of [-0.84, 0.84]) {
    for (const dx of [-0.16, 0.16]) for (const z of [0.29, 0.73]) {
      box(x+dx-0.034,0.02,z-0.035,x+dx+0.034,z+0.035 > 0.7 ? 1.21 : 0.52,z+0.035,wood,gold,0.8);
    }
    cushion(brush, x, 0.43, 0.51, 0.37, 0.55, 0.08, '#8b5e4d', '#dda37e');
    box(x-0.19,0.82,0.71,x+0.19,1.26,0.83,'#6d493f','#e1aa82',0.9);
    line(panel(x-0.1,0.88,0.20,0.31,0.835),gold,0.72,true);
    line(oval(x * 0.52,1.049,-0.04,0.16,0.14),'#f0d2af',0.95,true);
  }
  segment([-0.16,1.046,-0.49],[-0.16,1.046,0.36],'#b58170',0.9);
  segment([0.16,1.046,-0.49],[0.16,1.046,0.36],'#b58170',0.9);
}

function stampedSpine({line, segment}, x, y) {
  const at = (u, v) => [x+u,y+v,0.217];
  const mint = '#a0e6d3';
  line(oval(x,y+0.225,0.217,0.059,0.109,'xy',20),mint,0.8,true);
  line([at(-0.045,0.225),at(-0.021,0.244),at(0,0.248),at(0.021,0.244),at(0.045,0.225),
    at(0.021,0.206),at(0,0.202),at(-0.021,0.206)],mint,0.72,true);
  line(oval(x,y+0.225,0.217,0.010,0.018,'xy',12),mint,0.64,true);
  for (const side of [-1,1]) {
    line([at(side*0.060,0.213),at(side*0.078,0.213),at(side*0.078,0.078),at(side*0.098,0.069)],gold,0.76);
  }
  segment(at(-0.10,0.065),at(0.10,0.065),gold,0.6);
  segment(at(-0.054,0.036),at(-0.029,0.065),gold,0.55);
}

function bookcase(brush) {
  const {box, line, segment} = brush;
  const ink = '#b5b8db';
  box(-0.8,0.08,-0.32,0.8,2.55,-0.25,'#373044',ink);
  for (const x of [-0.75,0.75]) box(x-0.07,0.08,-0.31,x+0.07,2.57,0.32,'#48384f','#b38aa9');
  for (const y of [0.11,0.69,1.27,1.85,2.53]) box(-0.8,y,-0.31,0.8,y+0.085,0.32,'#594357','#ce9bb1',0.94);
  const books = [['#594268','#b3a4d7'],['#684a48','#edbc89'],['#3c5b5a','#91c8b6'],['#66495d','#e1a2c0']];
  for (const [row, y] of [0.2,0.78,1.36,1.94].entries()) {
    let x = -0.61 + row % 2 * 0.1;
    for (let i = 0; i < 7; i++) {
      const height = 0.27 + ((i * 13 + row * 7) % 11) / 58;
      const [fill, colour] = books[(i + row * 3) % books.length];
      const stamped = row === 2 && i === 3, width = stamped ? 0.22 : 0.12;
      box(x,y,-0.22,x+width,y+height,0.21,fill,colour,0.71);
      if (stamped) stampedSpine(brush,x+width/2,y);
      else segment([x+0.02,y+height-0.06,0.214],[x+0.1,y+height-0.06,0.214],colour,0.62);
      x += width + 0.025 + (i === 2 ? 0.06 : 0);
    }
  }
  line([[-0.67,2.56,0.322],[0,2.64,0.322],[0.67,2.56,0.322]],gold,1);
}

export const livingModels = {sofa, bed, table, bookcase};
export function drawDomestic(draw, mesh) { draw(brushFor(mesh)); }
