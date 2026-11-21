import {FloorPlan} from '../building/floor-plan.js';
import {InkMesh} from './ink-mesh.js';

const noise = (x, z, salt = 0) => {
  const n = Math.sin(x * 87.591 + z * 21.635 + salt * 118.715) * 19674.361;
  return n - Math.floor(n);
};

const cross = ([ax, az], [bx, bz], [cx, cz]) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
const between = (a,b,t) => a.map((n,i) => n+(b[i]-n)*t);

function convexHull(points) {
  const sorted = points.sort(([a,z],[b,w]) => a-b || z-w);
  const half = order => {
    const path = [];
    for (const point of order) {
      while (path.length >= 2 && cross(path.at(-2),path.at(-1),point) <= 0) path.pop();
      path.push(point);
    }
    return path.slice(0,-1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

function connectedGroups(segments) {
  const groups = [];
  const near = (a,b) => Math.hypot(
    Math.max(0,a.x-b.x-b.width,b.x-a.x-a.width),
    Math.max(0,a.z-b.z-b.depth,b.z-a.z-a.depth)
  ) <= 2.2;
  for (const segment of segments) {
    const connected = groups.filter(group => group.some(other => near(segment,other)));
    const merged = [segment,...connected.flat()];
    for (const group of connected) groups.splice(groups.indexOf(group),1);
    groups.push(merged);
  }
  return groups;
}

function lawnOutline(group) {
  const hull = convexHull(group.flatMap(({x,z,width,depth}) => {
    const left=x-0.97, right=x+width+0.97, back=z-0.93, front=z+depth+0.95;
    return [[left+0.52,back],[right-0.48,back],[right,back+0.46],[right,front-0.52],
      [right-0.43,front],[left+0.5,front],[left,front-0.45],[left,back+0.51]];
  }));
  const points = hull.flatMap((point,i) => {
    const next = hull[(i+1)%hull.length];
    return [between(point,next,0.22),between(point,next,0.78)];
  });
  const center = points.reduce(([x,z],[a,b]) => [x+a/points.length,z+b/points.length],[0,0]);
  const outline = points.flatMap((point,i) => {
    const next = points[(i+1)%points.length];
    const count = Math.min(18,Math.max(1,Math.ceil(Math.hypot(point[0]-next[0],point[1]-next[1])/0.76)));
    return Array.from({length:count},(_,j) => {
      const base = between(point,next,j/count);
      const length = Math.hypot(base[0]-center[0],base[1]-center[1]);
      return between(base,center,(noise(base[0],base[1],5)-0.5)*0.24/(length || 1));
    });
  });
  return {outline,center};
}

function within(x,z,outline) {
  let inside = false;
  for (let i=0,j=outline.length-1;i<outline.length;j=i++) {
    const [a,b] = outline[i], [c,d] = outline[j];
    if ((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a) inside=!inside;
  }
  return inside;
}

function lawn(mesh, group, rooms) {
  const {outline,center} = lawnOutline(group);
  const rings = [
    [0,-0.086,'#28272b'],[0.18,-0.081,'#30332e'],[0.38,-0.074,'#383e35']
  ];
  for (const [inset,y,colour] of rings) {
    const edge = outline.map(point => {
      const distance = Math.hypot(center[0]-point[0],center[1]-point[1]);
      const [x,z] = between(point,center,Math.min(0.28,inset/(distance || 1)));
      return [x,y,z];
    });
    const middle = [center[0],y,center[1]];
    for (let i=0;i<edge.length;i++) mesh.face([middle,edge[i],edge[(i+1)%edge.length]],colour);
  }
  const left = Math.min(...outline.map(point => point[0])), right = Math.max(...outline.map(point => point[0]));
  const back = Math.min(...outline.map(point => point[1])), front = Math.max(...outline.map(point => point[1]));
  const stride = Math.max(0.52,Math.sqrt((right-left)*(front-back)/1200));
  for (let z=back;z<front;z+=stride) for (let x=left;x<right;x+=stride) {
    const px=x+noise(x,z,1)*stride, pz=z+noise(x,z,2)*stride;
    if (!within(px,pz,outline) || rooms.some(room => px>room.x && px<room.x+room.width && pz>room.z && pz<room.z+room.depth)) continue;
    const spread = 0.045 + noise(x,z,3) * 0.075;
    if (noise(x,z,4)<0.58) {
      mesh.line([[px-spread,-0.069,pz-0.055],[px,-0.069,pz],[px+spread*0.85,-0.069,pz-0.09]],'#6e795f',0.68);
      mesh.segment([px,-0.068,pz],[px+0.022,-0.068,pz+0.071],'#828b6d',0.69);
    } else {
      mesh.face([[px-spread,-0.070,pz],[px-0.035,-0.070,pz-spread],[px+spread,-0.070,pz-0.03],
        [px+spread*0.69,-0.070,pz+spread*0.7],[px-spread*0.7,-0.070,pz+spread*0.74]],'#50554a');
      mesh.segment([px-spread*0.8,-0.068,pz],[px-0.035,-0.068,pz-spread],'#79796c',0.67);
    }
  }
}

export function landscape(rooms, garden) {
  const mesh = new InkMesh(0.25);
  const segments = [...rooms,...garden.map(piece => FloorPlan.footprint(piece))];
  for (const group of connectedGroups(segments)) lawn(mesh,group,rooms);
  return mesh;
}
