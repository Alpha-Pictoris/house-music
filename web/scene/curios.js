import { oval } from "./domestic-art.js";
import { brushFor } from "./furniture-art.js";
import { InkMesh, instance } from "./ink-mesh.js";

const tau = Math.PI * 2;
const brass = "#eab67e", amber = "#ffe19e", plum = "#523044", rose = "#e69aba";
const mint = "#9ff1d8", teal = "#518b8b", lilac = "#cfacf7", dark = "#251c32";

function hourglass({ lathe, line, segment }) {
  for (const y of [0.04, 1.83]) {
    lathe(0, 0, [[y, 0.44], [y + 0.05, 0.53], [y + 0.12, 0.49], [y + 0.16, 0.40]], plum, brass, 0.95, 12);
  }
  for (const [x,z] of [[-0.40,0.19],[0.40,0.19],[0,-0.44]]) {
    lathe(x, z, [[0.16,0.06],[0.29,0.085],[0.39,0.036],[1.60,0.036],[1.71,0.085],[1.85,0.059]], plum, brass, 0.8, 6);
  }
  const rims = [[0.21,0.30],[0.32,0.39],[0.51,0.38],[0.78,0.22],[0.97,0.044],
    [1.07,0.044],[1.31,0.24],[1.57,0.38],[1.72,0.38],[1.82,0.30]];
  for (const t of [0, 0.72, 2.40, Math.PI, 3.87, 5.55]) {
    line(rims.map(([y,r]) => [r*Math.cos(t),y,r*Math.sin(t)]), t === 0 || t === Math.PI ? mint : teal, 1.1);
  }
  for (const [y,r] of [rims[0],rims[4],rims.at(-1)]) line(oval(0,y,0,r,r), mint, 0.8, true);
  for (let i=0; i<12; i++) {
    const t=i*tau/12;
    segment([0.44*Math.cos(t),1.995,0.44*Math.sin(t)],[0.49*Math.cos(t),1.995,0.49*Math.sin(t)],amber,0.9);
  }
}

function mothlight({ lathe, line, shape, segment }) {
  lathe(0,0,[[0.015,0.39],[0.08,0.45],[0.16,0.35],[0.22,0.18],[0.36,0.09],[0.47,0.24]],dark,teal,1.1,10);
  lathe(0,0,[[0.43,0.31],[0.50,0.40],[0.57,0.35]],"#35424a",mint,1.05,8);
  lathe(0,0,[[0.57,0.105],[1.04,0.105],[1.12,0.081]],"#30232d",rose,0.78,9);
  shape([[-0.076,1.17,0],[0.02,1.42,0],[0.087,1.25,0],[0.043,1.14,0]],"#efd2a3",amber,1);
  for (let i=0; i<6; i++) {
    const t=i*tau/6;
    line([[0.30,0.54],[0.45,0.71],[0.47,1.45],[0.39,1.65],[0.16,1.83]].map(([r,y]) =>
      [r*Math.cos(t),y,r*Math.sin(t)]),i%2 ? teal : mint,1.25);
  }
  lathe(0,0,[[1.62,0.43],[1.70,0.49],[1.78,0.32],[1.90,0.18],[1.97,0.08]],"#2f4748",mint,1.0,8);
  line(oval(0,2.08,0,0.09,0.13,"xy",16),brass,1.25,true);
  segment([0,1.76,0],[0,1.56,0],brass,0.85);
}

function arch(width, bottom, height, z) {
  return [[-1,0],[1,0],[1,0.66],[0.84,0.80],[0.55,0.89],[0,1],[-0.55,0.89],[-0.84,0.80],[-1,0.66]]
    .map(([x,y]) => [x*width, bottom+y*height,z]);
}

function threshold({ box, face: fill, shape, line, segment }) {
  box(-0.80,0.02,-0.38,0.80,0.12,0.38,plum,brass);
  const back = arch(0.77,0.12,2.57,-0.11), front = arch(0.77,0.12,2.57,0.11);
  for (let i=0; i<back.length; i++) {
    const j=(i+1)%back.length;
    fill([back[i],back[j],front[j],front[i]],plum);
  }
  for (const facing of [-1,1]) {
    const depth = n => facing*n;
    const outside = facing === 1 ? front : back;
    const inside = arch(0.59,0.20,2.15,depth(0.125));
    for (let i=0; i<outside.length; i++) {
      const j=(i+1)%outside.length;
      fill([outside[i],outside[j],inside[j],inside[i]],plum);
    }
    line(outside,rose,1.45,true);
    shape(inside,"#1b1428",lilac,1.5);
    for (const scale of [0.73,0.45,0.25]) {
      line(arch(0.60*scale,1.18-scale,2.15*scale,depth(0.14)),scale < 0.5 ? "#72b3b0" : "#c195d6",1.1,true);
    }
    for (const side of [-1,1]) {
      line([[side*0.59,0.20,depth(0.148)],[side*0.15,0.94,depth(0.148)]],lilac,0.75);
      for (const y of [0.46,0.93,1.40,1.86]) {
        const x = side*0.681;
        line([[x,y-0.075,depth(0.15)],[x+0.036,y,depth(0.15)],[x,y+0.075,depth(0.15)],[x-0.036,y,depth(0.15)]],brass,0.9,true);
      }
    }
    shape([[0,2.38,depth(0.155)],[0.13,2.47,depth(0.155)],[0,2.56,depth(0.155)],[-0.13,2.47,depth(0.155)]],dark,brass);
    segment([0,2.43,depth(0.16)],[0,2.51,depth(0.16)],mint,1.6);
  }
}

function moth({ shape, line }) {
  for (const side of [-1,1]) {
    const points = outline => outline.map(([x,y,z]) => [x*side,y,z]);
    shape(points([[0,0,0],[0.15,0.17,-0.025],[0.31,0.21,0],[0.25,0.055,0.027],
      [0.13,-0.035,0.018],[0.20,-0.15,0], [0.07,-0.10,0],[0,0.016,0]]),"#527f83",mint,1.15);
    line(points([[0.04,0.03,0.023],[0.16,0.107,0.023],[0.23,0.139,0.025]]),amber,0.9);
    line(points([[0,0.067,0.026],[0.05,0.146,0.028],[0.08,0.16,0.028]]),brass,0.85);
  }
  shape([[-0.022,0.04,0.03],[0,0.088,0.04],[0.024,0.04,0.03],[0,-0.12,0.04]],plum,rose,0.95);
}

const details = {
  moth,
  sand: ({lathe}) => lathe(0,0,[[0,0.31],[0.07,0.34],[0.38,0.035]],"#ba795f",amber,0.7,12),
  grain: ({shape}) => shape([[0,0.05,0],[0.031,0,0],[0,-0.034,0],[-0.031,0,0]],amber,brass,0.7),
  passage: ({line}) => line(arch(0.59,-1,2.15,0),mint,1.3,true)
};
const meshes = new Map();
export const curioModels = { hourglass, mothlight, threshold };

export class CurioArt {
  static append(items, piece, origin, turn, options) {
    const phase = options.pose === 0 || options.sweepX == null ? 0.07 : ((options.sweepX-piece.x)/4 % 1+1)%1;
    const angle = turn * Math.PI/2, [cos,sin] = [Math.cos(angle),Math.sin(angle)];
    const add = (name, x, y, z, scale, spin = 0, opacity = 1) => {
      if (!meshes.has(name)) {
        const mesh = new InkMesh();
        details[name](brushFor(mesh));
        mesh.model = true;
        mesh.canvasFront = name === "passage";
        meshes.set(name,mesh);
      }
      items.push(instance(meshes.get(name), { ...options, scale,
        origin: [origin[0]+cos*x+sin*z, origin[1]+y, origin[2]-sin*x+cos*z],
        turn: [Math.cos(angle+spin),Math.sin(angle+spin)], opacity: (options.opacity ?? 1)*opacity }));
    };
    if (piece.kind === "hourglass") {
      add("sand",0,0.25,0,[1,1.05-0.64*phase,1]);
      const fill = 0.24 + 0.64*phase;
      add("sand",0,1.08+fill*0.38,0,[fill,-fill,fill]);
      for (let i=0; i<5; i++) {
        const t=(phase*2+i/5)%1;
        add("grain",0.022*Math.sin(t*tau),0.43+t*0.99,0,[0.85,0.85,0.85],t*2);
      }
    } else if (piece.kind === "mothlight") {
      for (let i=0; i<2; i++) {
        const t=(phase+i*0.5)*tau, flap=0.68+0.30*Math.cos(4*t);
        add("moth",0.59*Math.cos(t),1.27+0.27*Math.sin(t*2+i),0.50*Math.sin(t),
          [flap,0.85,0.85],-t+0.32);
      }
    } else {
      for (let i=0; i<2; i++) {
        const t=(phase+i/2)%1, size=0.95-0.78*t;
        for (const side of [-1,1]) add("passage",0,1.19,side*0.155,[size,size,1],0,Math.sin(t*Math.PI)*0.85);
      }
    }
  }
}
