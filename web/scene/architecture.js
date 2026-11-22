import {FloorPlan} from '../building/floor-plan.js';
import {RoomShape} from '../building/room-shape.js';
import {InkMesh} from './ink-mesh.js';

const plotHalf = 40;

export function plot() {
  const mesh = new InkMesh(0.8);
  mesh.face(rectangle(-plotHalf, -plotHalf, plotHalf * 2, plotHalf * 2, -0.09), '#1b1422');
  for (let i = -plotHalf; i <= plotHalf; i++) {
    const colour = i === 0 ? '#644b6b' : i % 5 === 0 ? '#462f49' : '#302438';
    mesh.segment([i, -0.085, -plotHalf], [i, -0.085, plotHalf], colour, i === 0 ? 1.1 : 0.69);
    mesh.segment([-plotHalf, -0.085, i], [plotHalf, -0.085, i], colour, i === 0 ? 1.1 : 0.69);
  }
  return mesh;
}

export function originMark() {
  const mesh = new InkMesh();
  const origin = [[0, -0.075, -0.19], [0.19, -0.075, 0], [0, -0.075, 0.19], [-0.19, -0.075, 0]];
  mesh.face(origin, '#292134');
  mesh.line(origin, '#b297bd', 1.25, true);
  return mesh;
}

export function rectangle(x, z, width, depth, y = 0) {
  return [[x, y, z], [x + width, y, z], [x + width, y, z + depth], [x, y, z + depth]];
}

const finishes = {
  walnut: {floor: '#332331', base: '#33212e', floorInk: '#aa7987', wall: '#39253c', cap: '#513148', ink: '#b6829b', trim: '#805674'},
  moonstone: {floor: '#3f4d58', base: '#2f3a48', floorInk: '#8aa0af', wall: '#30474d', cap: '#4a666d', ink: '#91c9c4', trim: '#67969e'},
  moss: {floor: '#3b4b3c', base: '#313a35', floorInk: '#91aa7d', wall: '#344e3d', cap: '#4c6854', ink: '#aac691', trim: '#749475'}
};

function tiles(mesh, x, z, width, depth) {
  const columns = Math.max(1, Math.round(width / 0.66)), rows = Math.max(1, Math.round(depth / 0.66));
  const dx = width / columns, dz = depth / rows;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const left = x + col * dx, back = z + row * dz;
    mesh.face(rectangle(left, back, dx, dz), (row + col) % 2 ? '#495863' : '#32424e');
    mesh.line(rectangle(left+0.008, back+0.008, dx-0.016, dz-0.016, 0.002), '#647887', 0.62, true);
    if ((row*5+col*7)%4 === 0) {
      mesh.line([[left+dx*0.17,0.003,back+dz*0.67],[left+dx*0.44,0.003,back+dz*0.51],
        [left+dx*0.76,0.003,back+dz*0.23]], '#8a9fab', 0.65);
    }
  }
}

function wovenFloor(mesh, x, z, width, depth, border) {
  const color = finishes.moss;
  mesh.face(rectangle(x,z,width,depth), color.floor);
  if (border) for (const n of [0.12,0.24]) mesh.line(rectangle(x+n,z+n,width-n*2,depth-n*2,0.002), color.floorInk, 0.92, true);
  if (depth < 0.38 || width < 0.48) return;
  const rows = Math.max(1,Math.floor((depth-0.38)/0.58)), columns = Math.max(1,Math.floor((width-0.38)/0.67));
  for (let j=0;j<rows;j++) for (let i=0;i<columns;i++) {
    const cx = x+(i+0.5)*width/columns, cz = z+(j+0.5)*depth/rows;
    mesh.line([[cx-0.21,0.002,cz],[cx,0.002,cz-0.15],[cx+0.21,0.002,cz],[cx,0.002,cz+0.15]], '#697e64',0.74,true);
    mesh.segment([cx-0.06,0.002,cz],[cx+0.06,0.002,cz],'#a9ab7b',0.8);
  }
}

function floorboards(mesh, x, z, width, depth) {
  const palette = ['#332331', '#392633', '#352530', '#3d2936', '#362331'];
  const rows = Math.min(160, Math.ceil(depth / 0.42));
  for (let row = 0; row < rows; row++) {
    const start = z + depth * row / rows;
    const end = z + depth * (row + 1) / rows;
    let plank = 0;
    let left = x;
    while (left < x + width - 0.00001) {
      const right = Math.min(x + width, left + (plank === 0 ? 0.72 + row % 4 * 0.51 : 2.28));
      mesh.face(rectangle(left, start, right - left, end - start), palette[(row * 7 + plank * 3) % palette.length]);
      if (plank) mesh.segment([left, 0, start], [left, 0, end], '#735267', 0.65);
      const length = right - left;
      if (length > 0.6) {
        mesh.line([[left + length * 0.12, 0, start * 0.4 + end * 0.6],
          [left + length * 0.48, 0, start * 0.55 + end * 0.45],
          [left + length * 0.83, 0, start * 0.46 + end * 0.54]], '#624656', 0.46);
      }
      left = right;
      plank++;
    }
    mesh.segment([x, 0, start], [x + width, 0, start], '#725165', 0.78);
  }
}

export function roomFloor(room) {
  const mesh = new InkMesh();
  const style = finishes[room.finish] ?? finishes.walnut;
  for (const {x,z,width,depth} of RoomShape.parts(room)) {
    if (room.finish === 'moonstone') tiles(mesh,x,z,width,depth);
    else if (room.finish === 'moss') wovenFloor(mesh,x,z,width,depth,!room.sections);
    else floorboards(mesh,x,z,width,depth);
  }
  for (const wall of RoomShape.walls([room])) {
    const [a,b] = wallEnds(wall,0);
    mesh.face([a,b,[b[0],-0.064,b[2]],[a[0],-0.064,a[2]]],style.base);
    mesh.segment(a,b,style.floorInk,1.16);
  }
  return mesh;
}

function wallEnds({axis,at,start,end}, height) {
  return [start,end].map(along => axis === 'x' ? [along,height,at] : [at,height,along]);
}

export function roomOutline(room, colour, fill) {
  const mesh = new InkMesh();
  if (fill) for (const r of RoomShape.parts(room)) mesh.face(rectangle(r.x,r.z,r.width,r.depth,0.034),colour);
  for (const wall of RoomShape.walls([room])) mesh.segment(...wallEnds(wall,0.035),colour,1.6);
  return mesh;
}

function wallSection(mesh, inner, outer, start, end, low, high, style) {
  mesh.face([inner(start,low),inner(end,low),inner(end,high),inner(start,high)], style.wall);
  mesh.face([outer(start,low),outer(end,low),outer(end,high),outer(start,high)], style.base);
  mesh.face([inner(start,high),inner(end,high),outer(end,high),outer(start,high)], style.cap);
  mesh.face([inner(start,low),outer(start,low),outer(start,high),inner(start,high)], style.cap);
  mesh.face([inner(end,low),outer(end,low),outer(end,high),inner(end,high)], style.cap);
  mesh.line([outer(start,low),outer(start,high),outer(end,high),outer(end,low)], style.trim, 0.88);
  mesh.line([inner(start,low),inner(start,high),inner(end,high),inner(end,low)], style.ink, 1.1);
}

function decorate(mesh, inner, start, end, height, style, finish) {
  for (const y of [0.085,0.19,0.87,0.94,height-0.12]) {
    mesh.segment(inner(start,y),inner(end,y),y === 0.94 ? style.ink : style.trim, y === 0.94 ? 1.12 : 0.71);
  }
  const panels = Math.max(1,Math.round((end-start)/1.32));
  for (let i=0;i<panels;i++) {
    const left = start+(end-start)*i/panels+0.10, right = start+(end-start)*(i+1)/panels-0.10;
    if (right-left < 0.17) continue;
    const mid = (left+right)/2;
    mesh.line([inner(left,0.29),inner(right,0.29),inner(right,0.72),inner(left,0.72)],style.trim,0.85,true);
    if (right-left < 0.38) continue;
    if (finish === 'moonstone') {
      const light = [[left,1.07],[right,1.07],[right,2.57],[left,2.57]].map(([x,y]) => inner(x,y));
      mesh.face(light, i%2 ? '#3c5c63' : '#3a565e');
      mesh.line(light,style.trim,0.86,true);
      mesh.line([inner(left,1.18),inner(right,2.23),inner(left,2.54)],'#7da8ad',0.82);
      mesh.segment(inner(mid,1.08),inner(mid,2.56),'#6c929d',0.75);
    } else if (finish === 'moss') {
      mesh.line([inner(mid,1.09),inner(mid-0.07,1.58),inner(mid+0.07,2.05),inner(mid,2.54)],style.ink,0.77);
      for (const [j,y] of [1.34,1.6,1.88,2.15].entries()) {
        const tip = mid + (j%2 ? -1 : 1)*Math.min(0.3,(right-left)*0.37);
        mesh.line([inner(mid,y),inner(tip,y+0.11),inner(tip,y+0.24),inner(mid,y+0.14)],style.trim,0.83,true);
      }
    } else {
      mesh.line([inner(left,1.09),inner(right,1.09),inner(right,2.57),inner(mid,2.71),inner(left,2.57)],style.trim,0.72,true);
      mesh.line([inner(mid,2.19),inner(mid+0.13,1.93),inner(mid,1.67),inner(mid-0.13,1.93)],style.trim,0.84,true);
    }
  }
}

function windowCuts(window, room, axis, at) {
  if (window.roomId !== room.id) return null;
  const opening = FloorPlan.windowOpening(window);
  if (axis !== opening.axis || Math.abs(opening.at-at)>0.004) return null;
  return [opening.start+0.11,opening.end-0.11];
}

export function walls(house, windows = []) {
  const mesh = new InkMesh();
  const byId = new Map(house.rooms.map(room => [room.id,room]));
  for (const {axis,at,start,end,rooms,back} of FloorPlan.walls(house)) {
    const room = byId.get(rooms[0]);
    if (!room) continue;
    const shared = rooms.length > 1;
    const sign = back ? 1 : -1;
    const windowsHere = shared ? [] : windows.map(window => windowCuts(window,room,axis,at))
      .filter(cut => cut && cut[0] >= start-0.002 && cut[1] <= end+0.002).sort(([a],[b]) => a-b);
    const height = shared ? 0.34 : back ? 2.9 : 0.16;
    const style = finishes[room.finish] ?? finishes.walnut;
    const point = (along,y,normal) => axis === 'x' ? [along,y,at+normal] : [at+normal,y,along];
    const inner = (along,y) => point(along,y,sign*0.06);
    const outer = (along,y) => point(along,y,-sign*0.01);
    const span = (from,to) => {
      if (to-from<0.003) return;
      wallSection(mesh,inner,outer,from,to,0,height,style);
      if (height>0.35) decorate(mesh, (x,y) => point(x,y,sign*0.065), from,to,height,style,room.finish);
    };
    let left = start;
    if (height>0.35) for (const [from,to] of windowsHere) {
      span(left,from);
      wallSection(mesh,inner,outer,from,to,0,0.56,style);
      wallSection(mesh,inner,outer,from,to,2.36,height,style);
      const mid = (from+to)/2;
      mesh.face([inner(from,1.88),inner(from,2.36),inner(mid,2.48)],style.wall);
      mesh.face([inner(to,1.88),inner(to,2.36),inner(mid,2.48)],style.wall);
      left = to;
    }
    span(left,end);
  }
  return mesh;
}

export function footprintMark(width, depth, colour, fill, onset) {
  const mesh = new InkMesh();
  const corners = rectangle(0, 0, width, depth, 0.034);
  if (fill) mesh.face(corners, colour);
  mesh.line(corners, colour, 1.5, true);
  if (onset) {
    mesh.segment([0, 0.04, depth], [0, 0.04, depth + 0.28], colour, 2);
    mesh.face([[0, 0.04, depth + 0.17], [-0.09, 0.04, depth + 0.29],
      [0, 0.04, depth + 0.41], [0.09, 0.04, depth + 0.29]], colour);
  }
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i];
    for (const next of [corners[(i + 1) % 4], corners[(i + 3) % 4]]) {
      mesh.segment(corner, corner.map((n, j) => n + (next[j] - n) * Math.min(0.4, 0.16 / (Math.hypot(next[0] - corner[0], next[2] - corner[2]) || 1))), colour, 2.6);
    }
  }
  return mesh;
}

export function doorMark(axis, colour) {
  const mesh = new InkMesh();
  const point = (across, y, inset = 0) => axis === 'x' ? [across, y, inset] : [inset, y, across];
  mesh.line([point(-0.52, 0.035), point(-0.52, 0.74), point(0.52, 0.74), point(0.52, 0.035)], colour, 1.7);
  mesh.segment(point(-0.52, 0.035), point(0.52, 0.035), colour, 1.15);
  mesh.line([point(-0.52, 0.035), point(-0.44, 0.035, 0.27), point(-0.22, 0.035, 0.46), point(0.04, 0.035, 0.52)], colour, 0.85);
  return mesh;
}

export function exteriorEntries(house) {
  const mesh = new InkMesh();
  const rooms = new Map(house.rooms.map(room => [room.id, room]));
  for (const door of house.doors) {
    if (door.rooms.length !== 1) continue;
    const room = rooms.get(door.rooms[0]);
    if (!room) continue;
    const {x,z} = door;
    const wall = FloorPlan.doorAt(house, door, 0.00001);
    if (!wall) continue;
    const horizontal = wall.axis === "x", back = wall.back;
    const outward = back ? -1 : 1;
    const point = (u,y,v) => horizontal ? [x+u,y,z+outward*v] : [x+outward*v,y,z+u];
    const slab = (width, near, far, top, bottom, finish) => {
      const a=point(-width,top,near), b=point(width,top,near), c=point(width,top,far), d=point(-width,top,far);
      mesh.face([a,b,c,d],finish);
      mesh.face([c,d,point(-width,bottom,far),point(width,bottom,far)],'#4a424a');
      mesh.face([a,d,point(-width,bottom,far),point(-width,bottom,near)],'#524858');
      mesh.face([b,c,point(width,bottom,far),point(width,bottom,near)],'#514958');
      mesh.line([a,b,c,d],'#bea69a',0.9,true);
    };
    slab(0.61,-0.02,0.58,-0.031,-0.072,'#6c6068');
    slab(0.54,-0.10,0.33,0.018,-0.032,'#80706e');
    for (const u of [-0.27,0.29]) mesh.segment(point(u,-0.029,0.34),point(u,-0.029,0.57),'#a28f91',0.68);
    mesh.segment(point(-0.46,0.021,0.14),point(0.46,0.021,0.14),'#b5a09a',0.76);

    const postHeight = back ? 1.64 : 0.35;
    for (const side of [-1,1]) {
      const u = 0.47*side, a=u-0.055, b=u+0.055;
      mesh.face([point(a,0.02,0.045),point(b,0.02,0.045),point(b,postHeight,0.045),point(a,postHeight,0.045)],'#645362');
      mesh.face([point(a,0.02,-0.085),point(a,0.02,0.047),point(a,postHeight,0.047),point(a,postHeight,-0.085)],'#594b60');
      mesh.line([point(a,0.025,-0.078),point(a,postHeight,-0.078),point(b,postHeight,-0.078),point(b,0.025,-0.078)],'#bca3a2',1.02);
      for (let y=0.19;y<postHeight-0.04;y+=0.27) mesh.segment(point(a,y,-0.077),point(b,y,-0.077),'#a88f98',0.76);
    }
    if (!back) continue;
    const style = finishes[room.finish] ?? finishes.walnut;
    wallSection(mesh, (u,y) => point(u,y,-0.06), (u,y) => point(u,y,0.01), -0.5,0.5,2.22,2.9,style);
    for (let i=0;i<8;i++) {
      const rimPoint = (t,r,v) => point(Math.cos(t)*r,postHeight+Math.sin(t)*r*1.06,v);
      const start = i*Math.PI/8, end=(i+1)*Math.PI/8;
      const outerA=rimPoint(start,0.53,-0.09), outerB=rimPoint(end,0.53,-0.09);
      const innerA=rimPoint(start,0.416,-0.09), innerB=rimPoint(end,0.416,-0.09);
      mesh.face([outerA,outerB,point(Math.cos(end)*0.53,2.225,-0.06),point(Math.cos(start)*0.53,2.225,-0.06)],style.wall);
      mesh.face([innerA,outerA,outerB,innerB],i%2?'#745c68':'#806978');
      mesh.face([innerA,innerB,rimPoint(end,0.416,0.047),rimPoint(start,0.416,0.047)],'#5e4b57');
      mesh.line([innerA,outerA,outerB,innerB],'#bca3a2',0.87,true);
    }
  }
  return mesh;
}
