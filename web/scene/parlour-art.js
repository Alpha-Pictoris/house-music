import { oval, panel } from "./domestic-art.js";

const wood = "#432d42", rose = "#cf93ad", gilt = "#edc487", plum = "#6e4466";
const teal = "#9ce7cc", glass = "#3f706e", gold = "#b38c55";

function shelf({ box, line, shape, segment }) {
  for (const x of [-0.93, 0.93]) {
    box(x-0.06,0.04,-0.31,x+0.06,1.93,0.32,wood,rose);
    shape([[x-0.09,1.93,0.29],[x,2.22,0.29],[x+0.09,1.93,0.29]],plum,gilt);
  }
  for (const y of [0.55, 1.36]) {
    box(-0.96,y,-0.34,0.96,y+0.09,0.34,wood,rose);
    segment([-0.92,y+0.04,0.342],[0.92,y+0.04,0.342],gilt,0.85);
  }
  for (const x of [-0.86,0,0.86]) segment([x,0.59,-0.30],[x,1.87,-0.30],rose,1.1);
  const arch = Array.from({length: 19}, (_,i) => {
    const t = Math.PI * i / 18;
    return [0.93*Math.cos(t),1.88+0.33*Math.sin(t),-0.29];
  });
  line(arch,gilt,1.4);
  line(arch.map(([x,y,z]) => [x*0.93,y-0.09,z]),rose,0.9);
  line(oval(0,2.07,-0.29,0.085,0.085,"xy",14),gilt,1,true);
}

function consoleTable({ box, lathe, line, shape }) {
  for (const x of [-0.85,0.85]) for (const z of [-0.25,0.25]) {
    lathe(x,z,[[0.02,0.085],[0.11,0.10],[0.30,0.038],[0.72,0.065],[0.88,0.12]],wood,gilt,0.85,8);
  }
  box(-1.02,0.84,-0.32,1.02,1.045,0.32,plum,rose);
  box(-1.12,1.04,-0.405,1.12,1.105,0.405,wood,gilt);
  for (const x of [-0.50,0.50]) {
    line(panel(x-0.44,0.87,0.88,0.13,0.325),rose,0.85,true);
    const crescent = [[-0.11,0.97],[-0.065,0.89],[0.025,0.875],[0.095,0.921],[0.11,0.99],[0.045,0.935],[-0.025,0.927]];
    shape(crescent.map(([u,y]) => [x+u,y,0.35]),gold,gilt,0.9);
  }
}

function chair({ box, shape, line }) {
  for (const x of [-0.40,0.40]) for (const z of [-0.36,0.36]) {
    box(x-0.05,0.02,z-0.05,x+0.05,0.46,z+0.05,wood,gilt,0.85);
  }
  box(-0.47,0.37,-0.41,0.47,0.57,0.46,plum,rose);
  shape([[-0.47,0.51,-0.38],[-0.53,1.28,-0.45],[-0.33,1.54,-0.47],[0,1.66,-0.48],
    [0.33,1.54,-0.47],[0.53,1.28,-0.45],[0.47,0.51,-0.38]],plum,rose,1.4);
  for (const side of [-1,1]) {
    shape([[side*0.47,0.53,-0.40],[side*0.52,1.36,-0.43],[side*0.55,1.22,-0.05],
      [side*0.40,0.88,0.05],[side*0.54,0.83,0.44],[side*0.53,0.52,0.43]],wood,rose);
  }
  for (const [x,y] of [[-0.19,1.10],[0.19,1.10],[0,1.32],[0,0.87]]) line(oval(x,y,-0.391,0.035,0.035,"xy",8),gilt,0.9,true);
}

function clock({ box, line, lathe, segment, shape }) {
  box(-0.40,0.04,-0.31,0.40,0.22,0.31,wood,gilt);
  box(-0.30,0.22,-0.24,0.30,1.64,0.24,wood,rose);
  shape(panel(-0.21,0.36,0.42,1.13,0.246),"#282831",gilt);
  segment([0,1.44,0.26],[-0.08,0.61,0.26],gilt,1.2);
  shape(oval(-0.08,0.56,0.27,0.108,0.125,"xy",16),gold,gilt,1.1);
  box(-0.36,1.63,-0.28,0.36,2.25,0.28,plum,rose);
  shape(oval(0,1.94,0.287,0.262,0.262,"xy",32),"#d6bd9a",gilt,1.2);
  for (let i=0;i<12;i++) {
    const t = i*Math.PI/6, x=Math.sin(t), y=Math.cos(t);
    segment([0.21*x,1.94+0.21*y,0.295],[0.24*x,1.94+0.24*y,0.295],wood,1);
  }
  line([[-0.105,2.02,0.30],[0,1.94,0.30],[0.067,2.105,0.30]],wood,1.8);
  for (const x of [-0.30,0.30]) lathe(x,0,[[2.25,0.05],[2.34,0.08],[2.45,0]],wood,gilt,0.8,8);
  shape([[-0.27,2.26,0.20],[0,2.49,0.20],[0.27,2.26,0.20]],plum,rose);
}

function bottle({ lathe, line, shape }) {
  lathe(0,0,[[0.01,0.085],[0.065,0.145],[0.19,0.16],[0.29,0.112],[0.34,0.058],[0.415,0.055]],
    glass,teal,0.88,12);
  lathe(0,0,[[0.397,0.070],[0.427,0.075],[0.43,0.043],[0.49,0.057]],gold,gilt,0.8,10);
  shape([[0,0.10,0.158],[-0.063,0.19,0.157],[0,0.263,0.138],[0.063,0.19,0.157]],"#384958",teal,1);
  line([[-0.105,0.11,0.11],[-0.113,0.19,0.113],[-0.085,0.243,0.099]],"#e0fff2",1);
}

function grimoire({ box, line, segment }) {
  box(-0.19,0.013,-0.14,0.19,0.12,0.14,"#c8a585",gilt,0.65);
  for (const y of [0.012,0.125]) box(-0.20,y,-0.155,0.20,y+0.018,0.155,plum,rose,0.85);
  box(-0.20,0.016,-0.15,-0.157,0.14,0.15,wood,rose,0.65);
  line([[0.018,0.146,-0.103],[0.11,0.146,0],[0.018,0.146,0.103],[-0.075,0.146,0]],gilt,1,true);
  segment([0.025,0.143,0.152],[0.08,0.076,0.17],rose,1.5);
}

function bell({ lathe, line }) {
  lathe(0,0,[[0.018,0.157],[0.045,0.158],[0.08,0.123],[0.19,0.091],[0.242,0.050],[0.255,0.027]],
    gold,gilt,0.9,14);
  lathe(0,0,[[0.25,0.027],[0.31,0.045],[0.41,0.026],[0.44,0.048],[0.47,0.022]],plum,rose,0.85,10);
  line(oval(0,0.064,0,0.14,0.14),gilt,0.9,true);
}

function orrery({ lathe, line, segment }) {
  lathe(0,0,[[0.01,0.11],[0.042,0.125],[0.075,0.060],[0.17,0.032]],wood,gilt,0.9,12);
  for (let ring=0;ring<2;ring++) {
    const rim = Array.from({length:28},(_,i) => {
      const t = i*2*Math.PI/28;
      return [0.19*Math.cos(t),0.30+Math.sin(t)*(ring ? 0.16 : 0.058),Math.sin(t)*(ring ? -0.072 : 0.17)];
    });
    line(rim,ring ? teal : gilt,1,true);
  }
  segment([0,0.16,0],[0,0.37,0],gilt,1);
  lathe(0,0,[[0.243,0.018],[0.276,0.052],[0.31,0.063],[0.35,0.040],[0.365,0.012]],gold,gilt,0.65,10);
  lathe(0.14,-0.051,[[0.375,0.012],[0.403,0.030],[0.428,0.011]],glass,teal,0.8,8);
}

export const parlourModels = { shelf, console: consoleTable, chair, clock, bottle, grimoire, bell, orrery };
