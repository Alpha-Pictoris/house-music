import {oval} from './domestic-art.js';

function fern({lathe, shape, line, segment}) {
  lathe(0,0,[[0.025,0.23],[0.10,0.28],[0.29,0.36],[0.39,0.36]],
    '#55413f','#b98c77',0.95,14);
  const stems = [0.71,0.9,1.26,1.39,1.0,0.82,1.18];
  for (const [i, height] of stems.entries()) {
    const angle = i * 2.39996, a = Math.cos(angle), b = Math.sin(angle);
    const point = t => [a*(0.03+0.44*t*t),0.38+(height-0.38)*Math.sin(t*1.8),b*(0.03+0.44*t*t)];
    const stem = Array.from({length: 8}, (_, index) => point(index/7));
    line(stem,'#bdd69a',0.9);
    for (let k = 2; k < 8; k++) {
      const t = k / 8, p = point(t);
      for (const sign of [-1,1]) {
        const spread = (0.145 - t*0.09) * sign;
        const tip = [p[0] - b*spread + a*0.018,p[1]+0.035,p[2] + a*spread + b*0.018];
        shape([p,[p[0] - b*spread*0.65,p[1]-0.04,p[2]+a*spread*0.65],tip,
          [p[0]+a*0.044,p[1]+0.045,p[2]+b*0.044]], i % 2 ? '#485f4a' : '#456554','#a6c78d',0.65);
      }
    }
    segment(stem.at(-2),stem.at(-1),'#cee2a9',0.8);
  }
}

function tree({lathe, face, line, segment}) {
  lathe(0,0,[[0.02,0.21],[0.25,0.15],[0.92,0.105],[1.72,0.074],[2.55,0.025]],'#534040','#bd947c',0.88,10);
  for (const [x,y,z] of [[-0.56,1.95,0.18],[0.65,2.11,-0.12],[0.05,2.52,0.29]]) {
    line([[0,y-0.77,0],[x*0.58,y-0.31,z*0.59],[x,y,z]],'#bb9584',2.6);
  }
  const crowns = [[0,2.31,0,0.78,0.73,0.68],[-0.44,2.15,0.13,0.59,0.70,0.53],
    [0.41,2.14,-0.16,0.59,0.68,0.57],[0.11,2.69,0.02,0.54,0.56,0.56]];
  for (const [index, [x,y,z,width,height,depth]] of crowns.entries()) {
    const rim = (rise, radius) => oval(x,y+height*rise,z,width*radius,depth*radius,'xz',12);
    const rows = [rim(-0.64,0.52),rim(-0.12,1),rim(0.62,0.73),rim(1,0.09)];
    const greens = ['#344e46','#3c594e','#4c6a56'];
    for (let r = 1; r < rows.length; r++) for (let i = 0; i < rows[r].length; i++) {
      const j = (i+1) % rows[r].length;
      face([rows[r-1][i],rows[r-1][j],rows[r][j],rows[r][i]],greens[(index+i+r)%greens.length]);
    }
    line(rows[1],'#88ac8b',0.62,true);
    for (let i=0;i<rows[2].length;i+=2) segment(rows[2][i],rows[3][(i+1)%rows[3].length],'#a0b98e',0.71);
  }
  for (const [x,z] of [[0.23,0.19],[-0.22,-0.12],[0.10,-0.28]]) segment([0,0.145,0],[x,0.03,z],'#b69681',1.45);
}

function path({shape, line}) {
  const stone = (x,z,w,d) => [[x-w+0.08,0.07,z-d],[x+w-0.07,0.07,z-d],[x+w,0.07,z-d+0.09],
    [x+w-0.05,0.07,z+d],[x-w+0.06,0.07,z+d],[x-w,0.07,z+d-0.08]];
  shape(stone(0,-0.27,0.49,0.19),'#5d595d','#a6a5a2',0.9);
  shape(stone(-0.23,0.14,0.21,0.17),'#555765','#949aa7',0.86);
  shape(stone(0.25,0.17,0.21,0.205),'#6c6363','#aba39c',0.9);
  shape(stone(-0.14,0.4,0.3,0.065),'#615d63','#a49ca5',0.76);
  line([[-0.37,0.074,-0.28],[-0.16,0.074,-0.24],[-0.11,0.074,-0.12]],'#837d78',0.7);
}

function fountain({lathe, shape, face, line, segment}) {
  const stone = '#4c535e', pale = '#b4b8c5', water = '#89d9d6';
  lathe(0,0,[[0.03,0.66],[0.12,0.77],[0.19,0.8],[0.35,0.80],[0.41,0.82]],stone,pale,0.88,20);
  shape(oval(0,0.425,0,0.72,0.72),'#3a6673',water,1.15);
  for (const radius of [0.44,0.57]) line(oval(0,0.43,0,radius,radius),'#77b1b9',0.7,true);
  lathe(0,0,[[0.42,0.19],[0.54,0.135],[0.82,0.08],[0.92,0.14],[0.96,0.29],[1.05,0.35]],stone,pale,0.82,16);
  shape(oval(0,1.055,0,0.30,0.30),'#467280',water,0.88);
  for (let i=0;i<8;i++) {
    const a = Math.cos(i*Math.PI/4), b = Math.sin(i*Math.PI/4);
    line([[a*0.05,1.12,b*0.05],[a*0.11,1.47,b*0.11],[a*0.24,1.42,b*0.24],[a*0.3,1.11,b*0.30]],water,0.95);
    segment([a*0.32,1.02,b*0.32],[a*0.44,0.49,b*0.44],'#6bacb7',0.75);
  }
}
export const gardenModels = {fern, tree, path, fountain};
