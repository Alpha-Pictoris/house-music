import {brushFor} from './furniture-art.js';
import {oval} from './domestic-art.js';
import {InkMesh} from './ink-mesh.js';

const attach = {
  wardrobe: [0, 2.99, 0.43, 1],
  mirror: [0, 2.50, 0.16, 0.92],
  lamp: [0, 1.76, 0.42, 0.9],
  sofa: [0, 1.31, -0.34, 1],
  bed: [0.94, 1.26, -1.28, 0.88],
  table: [0, 1.02, -0.32, 0.93],
  bookcase: [0, 2.57, 0.23, 0.95],
  stove: [0.0, 1.19, 0.33, 0.82],
  tub: [0.69, 0.83, -0.32, 0.78],
  rug: [0.79, 0.04, -0.52, 0.46],
  fern: [0, 0.30, 0.30, 0.67],
  window: [0, 1.36, 0.09, 0.78],
  tree: [0.1, 0.97, 0.11, 0.8],
  path: [0, 0.065, 0.08, 0.5],
  fountain: [0, 1.02, 0, 0.76]
};

function thorn({face, shape, line}) {
  const outline = [[-0.047,0,0],[0.056,0,0],[0.052,0.19,0],[0.21,0.37,0],[0.21,0.55,0],
    [0.12,0.43,0],[0.04,0.35,0],[-0.085,0.45,0],[-0.22,0.53,0],[-0.145,0.36,0],[-0.052,0.24,0]];
  for (let i=0;i<outline.length;i++) {
    const a = outline[i], b = outline[(i+1)%outline.length];
    face([a,b,[b[0],b[1],-0.055],[a[0],a[1],-0.055]],'#794655');
  }
  shape(outline,'#6b374a','#ff9788',1.75);
  line([[0,0.02,0.008],[0,0.25,0.008],[0.13,0.42,0.008]],'#ffd0b7',0.9);
}

function ring({face, line, segment}) {
  for (const [x,y,z] of [[-0.1,0.26,0.004],[0.105,0.22,0.04]]) {
    const rims = [
      oval(x,y,z-0.036,0.104,0.146,'xy',18),
      oval(x,y,z,0.121,0.166,'xy',18),
      oval(x,y,z+0.028,0.106,0.153,'xy',18),
      oval(x,y,z+0.018,0.081,0.126,'xy',18),
      oval(x,y,z-0.036,0.081,0.126,'xy',18)
    ];
    const shades = ['#3b6564','#638d80','#416b65','#305455'];
    for (let row=1;row<rims.length;row++) for (let i=0;i<rims[row].length;i++) {
      const j = (i+1)%rims[row].length;
      face([rims[row-1][i],rims[row-1][j],rims[row][j],rims[row][i]],shades[row-1]);
    }
    line(rims[2],'#8cf3db',1.48,true);
    line(rims[3],'#b9ffec',0.88,true);
    segment([x*0.6,0.01,z],[x,y-0.15,z],'#77b6ad',1.42);
  }
}

function stud({lathe, shape}) {
  for (const x of [-0.15,0,0.15]) {
    const y = x === 0 ? 0.14 : 0.1;
    lathe(x,0.025,[[0.01,0.041],[y-0.035,0.053],[y+0.032,0.026]],'#82683d','#edc980',1.2,8);
    shape(oval(x,y,0.062,0.052,0.058,'xy',10),'#b08a4a','#ffe2a0',1.05);
  }
}

function glass({shape, line}) {
  const top = [0,0.55,0.014], foot = [0,0.014,0.014], front = [0,0.23,0.12];
  const left = [-0.17,0.21,0.02], right = [0.17,0.21,0.02];
  shape([top,left,foot,front],'#625180','#c3b8fb',1.42);
  shape([top,front,foot,right],'#716c9c','#e0d0ff',1.42);
  line([top,[0,0.34,-0.055],foot],'#aba2cf',0.95);
}

function wire({face, line, shape, segment}) {
  const left = [-0.21,0.05,0], right = [0.20,0.05,0], top = [0.20,0.37,0];
  face([right,top,[top[0],top[1],-0.065],[right[0],right[1],-0.065]],'#677e59');
  face([left,top,[top[0],top[1],-0.065],[left[0],left[1],-0.065]],'#607253');
  shape([left,right,top], '#455447', '#d3e9a0', 1.6);
  for (const t of [0.22,0.39,0.56,0.73,0.90]) {
    const x = left[0] + (right[0] - left[0]) * t;
    segment([x,0.057,0.012],[x,0.05+0.32*t,0.012],'#e8f3aa',0.95);
  }
  line([left,[-0.13,0.002,0],[0.15,0.002,0],right],'#82ae78',1.0);
}

const ornaments = {thorn: [thorn,1], ring: [ring,2], stud: [stud,3], glass: [glass,3], wire: [wire,2]};
const meshes = new Map();

export function ornament(kind, fitting) {
  if (!ornaments[fitting] || !attach[kind]) return null;
  if (!meshes.has(fitting)) {
    const mesh = new InkMesh();
    ornaments[fitting][0](brushFor(mesh));
    mesh.segment([-0.07,0.005,0],[0.07,0.005,0],'#c69d83',1.35);
    mesh.model = true;
    meshes.set(fitting, mesh);
  }
  const [x,y,z,size] = attach[kind];
  return {mesh: meshes.get(fitting), local: [x,y,z], size, voice: ornaments[fitting][1]};
}
