import {oval, panel} from './domestic-art.js';

function stove({box, shape, line, segment}) {
  const iron = '#514447', brass = '#d9a977', glow = '#e5a67d';
  box(-0.65,0.14,-0.50,0.65,1.24,0.5,iron,'#b89995');
  box(-0.675,1.19,-0.525,0.675,1.31,0.525,'#5d4d4c','#d9af99');
  box(-0.36,1.31,-0.49,0.36,1.64,-0.30,'#5c4948',brass);
  for (const x of [-0.51,0.51]) for (const z of [-0.39,0.39]) box(x-0.07,0.02,z-0.07,x+0.07,0.2,z+0.07,iron,brass);
  shape(panel(-0.49,0.30,0.98,0.61,0.506),'#34272d',brass,1.35);
  shape(panel(-0.38,0.43,0.76,0.33,0.511),'#664139',glow);
  segment([-0.16,0.84,0.525],[0.16,0.84,0.525],brass,1.25);
  for (const x of [-0.43,-0.22,0,0.22,0.43]) line(oval(x,1.05,0.512,0.05,0.055,'xy',12),brass,0.85,true);
  for (const x of [-0.39,0.39]) for (const z of [-0.28,0.24]) {
    line(oval(x,1.318,z,0.17,0.137),'#b78776',0.8,true);
    line(oval(x,1.32,z,0.095,0.075),glow,0.65,true);
  }
}

function tub({face, shape, line, segment, lathe}) {
  const rim = oval(0,0.93,0,1,0.525), bowl = oval(0,0.21,0,0.73,0.36);
  const inner = oval(0,0.94,0,0.89,0.43), water = oval(0,0.70,0,0.76,0.37);
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length;
    face([bowl[i],bowl[j],rim[j],rim[i]], i % 3 === 0 ? '#496168' : '#3c525e');
    face([rim[i],rim[j],inner[j],inner[i]], '#aec6c3');
    face([inner[i],inner[j],water[j],water[i]], '#667e80');
  }
  shape(water,'#354e58','#83c2be',0.85);
  line(rim,'#d7e7d8',1.45,true);
  line(inner,'#a3ccc2',1.05,true);
  line(bowl,'#82aeb2',1.04,true);
  for (const x of [-0.53,0.53]) for (const z of [-0.24,0.24]) lathe(x,z,[[0.02,0.08],[0.09,0.105],[0.23,0.056]],'#614f52','#cfa78b',0.83,8);
  for (const x of [-0.36,0.06,0.42]) segment([x-0.12,0.705,-0.06],[x+0.07,0.705,0.1],'#91bcb9',0.71);
  line([[-0.71,0.91,-0.30],[-0.71,0.985,-0.30],[-0.64,0.995,-0.25],[-0.57,0.957,-0.20]],'#f1c68f',1.7);
}

function rug({shape, line, segment}) {
  const edge = (x,z,y) => [[-x+0.11,y,-z],[x-0.11,y,-z],[x,y,-z+0.11],[x,y,z-0.11],
    [x-0.11,y,z],[-x+0.11,y,z],[-x,y,z-0.11],[-x,y,-z+0.11]];
  shape(edge(1.19,0.84,0.038),'#633b57','#e3a3bd',1.3);
  shape(edge(1.06,0.70,0.04),'#753f59','#ad738e',0.85);
  for (const [x,z] of [[0,0],[-0.64,0],[0.64,0]]) {
    for (const size of [0.99,0.66]) line([[x-0.25*size,0.045,z],[x,0.045,z-0.32*size],
      [x+0.25*size,0.045,z],[x,0.045,z+0.32*size]],'#efba99',0.82,true);
  }
  for (const x of [-1,1]) for (let z = -0.69; z < 0.74; z += 0.13) {
    segment([x*1.18,0.042,z],[x*1.24,0.031,z+0.018],'#dc9db5',0.83);
  }
  for (const z of [-0.53,0.53]) line([[-0.79,0.045,z],[-0.49,0.045,z+0.09],[0,0.045,z],
    [0.49,0.045,z-0.09],[0.79,0.045,z]], '#d991aa',0.88);
}

function window({face, line, shape, segment}) {
  const lancet = (x, y, w, h, z) => [[x-w,y,z],[x+w,y,z],[x+w,y+h*0.69,z],
    [x+w*0.73,y+h*0.84,z],[x,y+h,z],[x-w*0.73,y+h*0.84,z],[x-w,y+h*0.69,z]];
  const reveal = lancet(0,0.52,0.69,1.98,-0.086);
  const front = lancet(0,0.52,0.69,1.98,0.045);
  for (let i=0;i<front.length;i++) {
    const j = (i+1)%front.length;
    face([reveal[i],reveal[j],front[j],front[i]], '#344854');
  }
  shape(front,'#253e50','#afe5d5',1.7);
  shape(lancet(0,0.61,0.59,1.75,0.052),'#354960','#7199ab',0.91);
  const jewel = [0,2.15,0.06], heart = [0,1.45,0.062];
  for (const side of [-1,1]) {
    const glass = side < 0 ? '#695e8a' : '#466980';
    face([heart,[side*0.55,1.61,0.06],[side*0.45,1.98,0.06],jewel],glass);
    shape([heart,[side*0.55,1.61,0.061],[side*0.55,0.66,0.061],[0,0.66,0.061]],
      side < 0 ? '#3e606e' : '#514864','#94b4bb',0.8);
    line([[side*0.56,0.96,0.063],[side*0.21,1.24,0.063],heart,[side*0.21,1.79,0.063],
      [side*0.54,1.91,0.063]],'#afccd0',0.92);
  }
  shape([[0,1.75,0.07],[0.24,1.42,0.07],[0,1.1,0.07],[-0.24,1.42,0.07]],'#987592','#dfc3d6',1.05);
  segment([0,0.61,0.07],[0,1.10,0.07],'#b5c7cb',0.9);
  segment([0,1.75,0.07],jewel,'#b5c7cb',0.9);
  shape(panel(-0.68,0.53,1.36,0.08,0.083),'#53646c','#b1cac3',1.1);
}
export const roomModels = {stove, tub, rug, window};
