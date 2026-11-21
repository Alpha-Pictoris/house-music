const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;

function pointsOn(count, fn) { return Array.from({length:count},(_,i)=>fn(i/count*TAU)); }
function oval(x,y,z,rx,ry) { return pointsOn(72,t=>[x+rx*Math.cos(t),y+ry*Math.sin(t),z]); }
function panel(x0,y0,x1,y1,z) { return [[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]]; }
function arch(x,bottom,z,width,height,shoulder=0.72) {
  const half=width/2, low=height*shoulder;
  const result=[[x-half,bottom,z],[x+half,bottom,z],[x+half,bottom+low,z]];
  for (let i=1;i<=32;i++) {
    const t=i/32*Math.PI, c=Math.cos(t);
    result.push([x+half*c,bottom+low+(height-low)*(1-Math.pow(Math.abs(c),0.85)),z]);
  }
  return result;
}
function diamond(x,y,z,w,h) { return [[x,y+h,z],[x+w,y,z],[x,y-h,z],[x-w,y,z]]; }

function brushFor(mesh) {
  const {face, line, segment} = mesh;
  function box(x0,y0,z0,x1,y1,z1,fill,ink,width=1) {
    const back=panel(x0,y0,x1,y1,z0), front=panel(x0,y0,x1,y1,z1);
    face(back,fill);
    for (let i=0;i<4;i++) {
      const j=(i+1)%4;
      face([back[i],back[j],front[j],front[i]],fill);
    }
    face(front,fill);
    if (!ink) return;
    line(back,ink,width,true); line(front,ink,width,true);
    for (let i=0;i<4;i++) segment(back[i],front[i],ink,width);
  }
  function shape(points,fill,ink,width=1) {
    face(points,fill); line(points,ink,width,true);
  }
  function lathe(x,z,sections,fill,ink,width=1,sides=32) {
    const rims=sections.map(([y,r])=>pointsOn(sides,t=>[x+r*Math.cos(t),y,z+r*Math.sin(t)]));
    for(let j=1;j<rims.length;j++) for(let i=0;i<sides;i++) {
      const k=(i+1)%sides;
      face([rims[j-1][i],rims[j-1][k],rims[j][k],rims[j][i]],fill);
    }
    face(rims[rims.length-1],fill);
    for(const rim of rims) line(rim,ink,width,true);
    for(let i=0;i<sides;i+=Math.max(1,Math.floor(sides/8))) line(rims.map(s=>s[i]),ink,width*0.75);
  }
  return {face, line, segment, box, shape, lathe};
}

function drawWardrobe(brush) {
  const {box, line, segment, shape} = brush;
  const red="#f6746f", rose="#ffaaa0", dark="#341a2b", mid="#96516e", gold="#ecc188";
  for(const x of [-0.80,0.80]) for(const z of [-0.40,0.41]){
    box(x-0.15,0.04,z-0.11,x+0.15,0.30,z+0.11,dark,mid,0.95);
    box(x-0.11,0.30,z-0.08,x+0.11,0.46,z+0.08,dark,red,0.84);
  }
  box(-1.04,0.43,-0.52,1.04,0.58,0.53,"#442034",red,1.35);
  box(-0.94,0.59,-0.47,0.94,2.94,0.48,dark,red,1.44);
  for(const side of [-1,1]) {
    const x=side*0.45, z=0.51;
    shape(panel(x-0.40,0.66,x+0.40,2.86,z),"#351829",red,1.05);
    line(arch(x,1.16,z+0.012,0.64,1.54,0.57),rose,1.16,true);
    line(arch(x,1.25,z+0.022,0.50,1.28,0.54),mid,0.80,true);
    line(panel(x-0.29,0.77,x+0.29,1.02,z+0.025),mid,0.79,true);
    line(diamond(x,1.89,z+0.04,0.12,0.37),"#ed9a85",0.93,true);
    segment([x,1.47,z+0.04],[x,2.42,z+0.04],"#ba6873",0.66);
    const knob=side*0.14;
    line(oval(knob,1.51,0.568,0.064,0.083),gold,1.45,true);
    segment([knob,1.58,0.57],[knob,1.69,0.57],gold,1.05);
  }
  for(const x of [-0.87,0.87]) for(const dx of [-0.035,0.035]){
    segment([x+dx,0.67,0.493],[x+dx,2.86,0.493],mid,0.74);
  }
  box(-1.02,2.94,-0.54,1.02,3.09,0.56,"#492335",red,1.29);
  box(-1.10,3.09,-0.58,1.10,3.17,0.60,dark,rose,1.10);
  const crown=[[-0.96,3.18],[-0.86,3.29],[-0.61,3.34],[-0.39,3.32],[-0.22,3.41],[0,3.65],[0.22,3.41],[0.39,3.32],[0.61,3.34],[0.86,3.29],[0.96,3.18]];
  const crest=crown.map(([x,y])=>[x,y,0.45]);
  shape(crest,"#3c1d2c",red,1.35);
  line(crown.slice(1,-1).map(([x,y])=>[x*0.85,3.19+(y-3.19)*0.6,0.47]),gold,0.83);
  line(diamond(0,3.36,0.49,0.065,0.115),gold,0.96,true);
  for(let x=-0.84;x<0.9;x+=0.13) segment([x,3.01,0.57],[x+0.043,3.07,0.57],mid,0.69);
}

function drawMirror(brush) {
  const {lathe, line, segment, shape} = brush;
  const aqua="#73e4d6", dim="#467f92", pale="#b7f9dc", silver="#b899c2", faceZ=0.07;
  for(const x of [-0.93,0.93]){
    lathe(x,-0.03,[[0.04,0.23],[0.13,0.23],[0.20,0.14],[0.34,0.07],[1.85,0.052],[2.02,0.11],[2.11,0.045]],"#182229",dim,0.83,16);
    segment([x,1.89,0.0],[x*0.82,1.89,0.0],pale,1.14);
  }
  line([[-0.93,0.44,0],[0,0.23,0],[0.93,0.44,0]],silver,1.04);
  const cy=1.94;
  shape(oval(0,cy,-0.10,0.82,1.41),"#171e29",dim,1.19);
  shape(oval(0,cy,faceZ,0.82,1.41),"#173039",aqua,1.65);
  for(const [rx,ry,ink] of [[0.76,1.33,pale],[0.70,1.24,dim]]) line(oval(0,cy,faceZ+0.015,rx,ry),ink,1.0,true);
  for(let i=0;i<34;i++){
    const t=i*TAU/34;
    segment([0.755*Math.cos(t),cy+1.32*Math.sin(t),0.11],[0.798*Math.cos(t),cy+1.38*Math.sin(t),0.11],dim,0.73);
  }
  for(const side of [-1,1]){
    line(Array.from({length:38},(_,i)=>{
      const t=i/37;
      return [mix(-0.43,0.43,t),cy+0.11+side*0.15*Math.sin(t*Math.PI),0.115];
    }),aqua,0.92);
  }
  line(oval(0,cy+0.11,0.12,0.083,0.12),pale,1.25,true);
  for(const [x,y,length] of [[-0.47,2.12,0.37],[-0.46,1.94,0.20],[0.23,1.37,0.26],[0.28,1.29,0.14]]){
    segment([x,y,0.105],[x+length*0.60,y+length,0.105],dim,0.82);
  }
  line(diamond(0,3.50,0.0,0.10,0.15),silver,1.04,true);
}

function drawLamp(brush) {
  const {face, lathe, line, segment} = brush;
  const green="#d6ed83", pale="#eff9ac", olive="#81915c", brass="#cbad73", shadow="#272822";
  lathe(0,0,[[0.03,0.44],[0.09,0.45],[0.16,0.33],[0.22,0.24],[0.33,0.14],[0.43,0.08],[1.96,0.047],[2.04,0.10],[2.15,0.075],[2.27,0.15]],shadow,brass,0.98);
  const profile=[[0.23,2.93],[0.35,2.83],[0.43,2.63],[0.61,2.36],[0.76,2.26]];
  const levels=profile.map(([r,y],j)=>pointsOn(56,t=>[
    r*(1+0.035*Math.cos(14*t))*Math.cos(t),
    y+(j===4?0.052*Math.cos(14*t):0),r*(1+0.035*Math.cos(14*t))*Math.sin(t)
  ]));
  for(let j=1;j<levels.length;j++) for(let i=0;i<56;i++){
    const k=(i+1)%56;
    face([levels[j-1][i],levels[j-1][k],levels[j][k],levels[j][i]],i%4<2?"#363c27":"#293023");
  }
  face(levels[0],"#41462d");
  line(levels[0],pale,1.15,true); line(levels[4],green,1.48,true);
  for(let i=0;i<56;i+=4){
    line(levels.map(s=>s[i]),i%8===0?green:olive,1.06);
    const p=levels[4][(i+2)%56], y=p[1]-0.12;
    segment(p,[p[0],y,p[2]],brass,0.70);
    segment([p[0],y,p[2]],[p[0],y-0.032,p[2]],pale,1.5);
  }
  lathe(0,0,[[2.94,0.1],[3.04,0.074],[3.14,0.015]],shadow,brass,0.88,12);
}
const models = {
  wardrobe: { draw: drawWardrobe, width: 2.2, depth: 1.2, height: 3.65 },
  mirror: { draw: drawMirror, width: 2.32, depth: 0.5, height: 3.65 },
  lamp: { draw: drawLamp, width: 1.56, depth: 1.56, height: 3.14 }
};

export function drawModel(kind, mesh) {
  const model = models[kind];
  model.draw(brushFor(mesh));
  return model;
}
