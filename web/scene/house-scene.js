import {FloorPlan} from '../building/floor-plan.js';
import {FurnitureSpots, quarterTurns} from '../building/furniture-spots.js';
import {parlourModels} from './parlour-art.js';
import {RoomShape} from '../building/room-shape.js';
import {furniture} from '../building/catalogue.js';
import {doorMark, exteriorEntries, footprintMark, originMark, plot, walls, roomFloor, roomOutline} from './architecture.js';
import {drawModel} from './furniture-art.js';
import {drawDomestic, livingModels} from './domestic-art.js';
import {roomModels} from './rooms-art.js';
import {gardenModels} from './garden-art.js';
import {landscape} from './landscape.js';
import {MarchingBand} from './marching-band.js';
import {marcherItem} from './marcher-art.js';
import {ornament} from './fittings-art.js';
import {InkMesh, channels, clamp, dot, instance, transformPoint} from './ink-mesh.js';
import {CanvasInkRenderer, WebInkRenderer} from './ink-renderer.js';

const emptyHouse = {rooms: [], doors: [], pieces: []};
const yellow = '#dff394';
const blue = '#8de9df';
const coral = '#ff8b82';
const lavender = '#c5abdb';
const models = new Map();
const houseModels = {...livingModels, ...roomModels, ...gardenModels, ...parlourModels};
const motionPreference = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
const quantizedLevel = level => Math.round(level * 100) / 100;

function previewKey(preview) {
  if (!preview) return null;
  const placement = preview.piece ?? preview;
  return [
    preview.type, preview.valid, placement.x, placement.z,
    placement.width, placement.depth, placement.kind, placement.turn, placement.axis, placement.finish, placement.fitting, JSON.stringify(placement.sections)
  ].join('|');
}

function sameLevels(current, previous) {
  if ((current?.size ?? 0) !== (previous?.size ?? 0)) return false;
  if (current) for (const [id, level] of current) {
    if (previous?.get(id) !== quantizedLevel(level)) return false;
  }
  return true;
}

function pieceItems(piece, options = {}) {
  const {kind, turn = 0} = piece;
  const {x, z, width, depth} = FloorPlan.footprint(piece);
  const definition = furniture[kind];
  if (!models.has(kind)) {
    const mesh = new InkMesh();
    let scale = [1, 1, 1];
    if (houseModels[kind]) {
      drawDomestic(houseModels[kind], mesh);
    } else {
      const dimensions = drawModel(kind, mesh);
      scale = [definition.width / dimensions.width, definition.height / dimensions.height, definition.depth / dimensions.depth];
    }
    mesh.model = true;
    mesh.canvasFront = kind === 'window';
    models.set(kind, {mesh, scale});
  }
  const {mesh, scale} = models.get(kind);
  const origin = options.origin ?? [x + width / 2, definition.garden ? -0.061 : 0, z + depth / 2];
  const direction = quarterTurns[turn];
  const fitting = ornament(kind, piece.fitting ?? definition.fitting);
  const level = fitting ? (options.level ?? 0) : 0;
  const body = instance(mesh, {
    ...options, scale, origin, turn: direction, level: level * 0.5, pose: 0, wobble: 1 / 0.43
  });
  const items = [body];
  if (fitting) {
    const [sx,y,sz] = fitting.local, [cos,sin] = direction, size = fitting.size;
    items.push(instance(fitting.mesh, { ...options,
      origin: [origin[0] + cos*sx + sin*sz, origin[1] + y, origin[2] - sin*sx + cos*sz],
      turn: direction, scale: [size,size,size], voice: fitting.voice, level, pose: options.pose ?? 1
    }));
  }
  for (const item of piece.contents ?? []) {
    const {x,y,z} = FurnitureSpots.anchor(piece,item.slot);
    items.push(...pieceItems({...item, x, z, turn}, {...options, origin: [x,y,z], level: options.levels?.get(item.id) ?? 0}));
  }
  return items;
}

class IsometricCamera {
  constructor(width, height, yaw, elevation, center, scale = 1) {
    this.width = width;
    this.height = height;
    this.center = center;
    this.scale = scale;
    const sx = Math.sin(yaw), cx = Math.cos(yaw);
    const sy = Math.sin(elevation), cy = Math.cos(elevation);
    this.right = [cx, 0, -sx];
    this.up = [-sx * sy, cy, -cx * sy];
    this.eye = [sx * cy, sy, cx * cy];
  }

  project(point) {
    const relative = point.map((n, i) => n - this.center[i]);
    return {
      x: this.width / 2 + dot(relative, this.right) * this.scale,
      y: this.height / 2 - dot(relative, this.up) * this.scale
    };
  }

  ray(x, y) {
    const horizontal = (x - this.width / 2) / this.scale;
    const vertical = (this.height / 2 - y) / this.scale;
    return this.center.map((n, i) => n + this.right[i] * horizontal + this.up[i] * vertical);
  }

  fit(box, zoom) {
    const span = axis => axis.reduce((sum, n, i) => sum + Math.abs(n) * box[i], 0);
    this.scale = zoom * Math.min(this.width / span(this.right), this.height / span(this.up));
  }
}

function rendererFor(canvas) {
  const gl = canvas.getContext('webgl', {alpha: true, antialias: true, depth: true, powerPreference: 'low-power'});
  if (gl) {
    try {
      const renderer = new WebInkRenderer(gl);
      canvas.dataset.renderer = 'webgl';
      return {renderer, target: canvas};
    } catch {
      const target = document.createElement('canvas');
      target.className = canvas.className;
      target.style.cssText = canvas.style.cssText;
      target.style.pointerEvents = 'none';
      target.setAttribute('aria-hidden', 'true');
      canvas.insertAdjacentElement('afterend', target);
      canvas.dataset.renderer = 'canvas';
      return {renderer: new CanvasInkRenderer(target.getContext('2d')), target};
    }
  }
  canvas.dataset.renderer = 'canvas';
  return {renderer: new CanvasInkRenderer(canvas.getContext('2d')), target: canvas};
}

function resize(canvas, width, height) {
  const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
  const pixelsX = Math.max(1, Math.round(width * ratio));
  const pixelsY = Math.max(1, Math.round(height * ratio));
  if (canvas.width === pixelsX && canvas.height === pixelsY) return false;
  canvas.width = pixelsX;
  canvas.height = pixelsY;
  return true;
}

function samePlacement(a, b, type) {
  if (!a || a.x !== b.x || a.z !== b.z) return false;
  if (type === 'pieces') return a.kind === b.kind && a.turn === b.turn && a.fitting === b.fitting && a.contents === b.contents;
  if (type === 'rooms') return a.width === b.width && a.depth === b.depth && a.finish === b.finish && a.sections === b.sections;
  return true;
}

function nearestDepth(item, camera, x, y, best = -Infinity) {
  for (const {points, width} of item.mesh.commands) {
    if (width) continue;
    const world = points.map(point => transformPoint(point, item));
    const projected = world.map(point => camera.project(point));
    const a = projected[0];
    for (let i = 2; i < points.length; i++) {
      const b = projected[i - 1], c = projected[i];
      const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(denominator) < 0.00001) continue;
      const s = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
      const t = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator;
      if (s < 0 || t < 0 || s + t > 1) continue;
      const depth = dot(world[0], camera.eye) * s + dot(world[i - 1], camera.eye) * t +
        dot(world[i], camera.eye) * (1 - s - t);
      best = Math.max(best, depth);
    }
  }
  return best;
}

export class HouseScene {
  yaw = 0.58;
  elevation = 0.53;
  magnification = 1;
  center = [0, 0.65, 0];
  bounds = [10, 0, 10];
  fitted = false;
  camera = null;
  floorCache = new Map();
  markCache = new Map();
  parade = new MarchingBand();

  constructor(canvas) {
    this.canvas = canvas;
    const {renderer, target} = rendererFor(canvas);
    this.renderer = renderer;
    this.target = target;
    this.ground = instance(plot(), {catchesSweep: false, canvasLayer: 0, inkLift: 0.000001});
    this.origin = instance(originMark(), {canvasLayer: 0});
    const mesh = new InkMesh();
    mesh.segment([0, -0.05, -1], [0, -0.05, 1], yellow, 1.3);
    this.sweep = mesh;
    this.motion = motionPreference();
    this.motion?.addEventListener('change', () => {
      if (this.lastRequest) this.draw(this.lastRequest);
    });
  }

  static thumbnail(canvas, kind, fitting) {
    const definition = furniture[kind];
    const items = pieceItems({kind, fitting, x: 0, z: 0, turn: 0});
    canvas.dataset.renderer = 'canvas';
    const renderer = new CanvasInkRenderer(canvas.getContext('2d'));
    const target = canvas;
    const motion = motionPreference();
    const repaint = () => {
      const {width, height} = canvas.getBoundingClientRect();
      if (!width || !height) return;
      resize(target, width, height);
      const center = [definition.width / 2, definition.height * 0.55, definition.depth / 2];
      const elevation = definition.height < 0.15 ? 0.87 : 0.34;
      const camera = new IsometricCamera(width, height, 0.36, elevation, center);
      camera.fit([definition.width * 1.21, definition.height * 1.15 + 0.28, definition.depth * 1.17], 1);
      renderer.draw(target, camera, items, {drawing: 0.8, wobble: motion?.matches ? 0 : 0.62});
    };
    repaint();
    motion?.addEventListener('change', repaint);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(repaint).observe(canvas);
  }

  static furniturePortrait(canvas, piece) {
    const {width,height} = canvas.getBoundingClientRect();
    if (!width || !height) return [];
    resize(canvas,width,height);
    const display = {...piece,x:0,z:0,turn:0}, design = furniture[piece.kind];
    const slots = FurnitureSpots.slots(piece.kind).map((_,i) => FurnitureSpots.anchor(display,i));
    const top = Math.max(design.height,...slots.map(p => p.y + 0.52));
    const center = [design.width/2,top/2,design.depth/2];
    const camera = new IsometricCamera(width,height,0.18,piece.kind === 'table' ? 0.68 : 0.22,center);
    camera.fit([design.width + 0.56, top + 0.22, design.depth + 0.32], 1);
    new CanvasInkRenderer(canvas.getContext('2d')).draw(canvas,camera,pieceItems(display),{ drawing:0.8,wobble:0 });
    return slots.map(p => camera.project([p.x,p.y,p.z]));
  }

  updateCamera(rect = this.canvas.getBoundingClientRect()) {
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (this.camera?.width === width && this.camera?.height === height) return this.camera;
    const camera = new IsometricCamera(width, height, this.yaw, this.elevation, this.center);
    const fit = this.fitted ? this.bounds : [10, 0, 10];
    camera.fit(fit, this.magnification);
    if (!this.fitted) camera.scale = Math.max(this.magnification * 0.72 * width / 14, camera.scale);
    this.camera = camera;
    return camera;
  }

  groundAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const camera = this.updateCamera(rect);
    const point = camera.ray(clientX - rect.left, clientY - rect.top);
    return {
      x: point[0] - point[1] * camera.eye[0] / camera.eye[1],
      z: point[2] - point[1] * camera.eye[2] / camera.eye[1]
    };
  }

  screenAt({x, z}, height = 0) {
    const rect = this.canvas.getBoundingClientRect();
    const point = this.updateCamera(rect).project([x, height, z]);
    return {x: rect.left + point.x, y: rect.top + point.y};
  }

  orbit(dx, dy) {
    this.yaw = clamp(this.yaw + dx * 0.006, 0.2, 1.30);
    this.elevation = clamp(this.elevation + dy * 0.004, 0.32, 0.98);
    this.camera = null;
  }

  zoom(factor) {
    this.magnification = clamp(this.magnification * factor, 0.42, 4);
    this.camera = null;
  }

  enter(house) {
    this.parade = new MarchingBand(house.rooms.length > 0 && house.band !== false);
    this.fit(house);
  }

  fit(house = emptyHouse) {
    this.magnification = 1;
    const grounds = [...house.rooms, ...house.pieces.map(piece => FloorPlan.footprint(piece))];
    this.fitted = grounds.length > 0;
    this.camera = null;
    if (!this.fitted) {
      this.center = [0, 0.65, 0];
      return;
    }
    const left = Math.min(...grounds.map(room => room.x));
    const right = Math.max(...grounds.map(room => room.x + room.width));
    const back = Math.min(...grounds.map(room => room.z));
    const front = Math.max(...grounds.map(room => room.z + room.depth));
    this.center = [(left + right) / 2, 1.35, (back + front) / 2];
    this.bounds = [right - left + 1.6, 3.7, front - back + 1.6];
  }

  pick(clientX, clientY, house) {
    const rect = this.canvas.getBoundingClientRect();
    const camera = this.updateCamera(rect);
    const x = clientX - rect.left, y = clientY - rect.top;
    const wallMesh = this.architecture(house).wallMesh;
    let nearest = nearestDepth(instance(wallMesh), camera, x, y);
    let id = null;
    for (const piece of house.pieces) {
      const body = pieceItems(piece, {level: this.lastLevels?.get(piece.id) ?? 0, pose: this.motion?.matches ? 0 : 1});
      const depth = Math.max(...body.map(item => nearestDepth(item, camera, x, y)));
      if (depth <= nearest) continue;
      nearest = depth;
      id = piece.id;
    }
    return id;
  }

  architecture(house) {
    const {rooms, doors, pieces} = house;
    const candidates = [this.structure, this.draftStructure].filter(entry => entry?.rooms === rooms && entry.doors === doors);
    const cached = candidates.find(entry => entry.pieces === pieces);
    if (cached) return cached;
    const windows = pieces.filter(piece => furniture[piece.kind].layer === 'wall');
    const garden = pieces.filter(piece => furniture[piece.kind].garden);
    const sameMembers = (a,b) => a.length === b.length && a.every((piece,i) => piece === b[i]);
    const shared = candidates.find(entry => sameMembers(entry.windows,windows) && sameMembers(entry.garden,garden));
    if (shared) {
      shared.pieces = pieces;
      return shared;
    }
    const floors = house.rooms.map(room => {
      const key = JSON.stringify([room.x, room.z, room.width, room.depth, room.finish, room.sections]);
      if (!this.floorCache.has(key)) {
        if (this.floorCache.size >= 48) this.floorCache.delete(this.floorCache.keys().next().value);
        this.floorCache.set(key, roomFloor(room));
      }
      return this.floorCache.get(key);
    });
    const entries = {
      rooms, doors, pieces, windows, garden, floors,
      wallMesh: walls(house, windows), entries: exteriorEntries(house), grounds: landscape(rooms, garden)
    };
    this.draftStructure = this.structure;
    this.structure = entries;
    return entries;
  }

  mark(x, z, width, depth, colour, fill = false, onset = false) {
    const key = JSON.stringify([width, depth, colour, fill, onset]);
    if (!this.markCache.has(key)) {
      if (this.markCache.size >= 24) this.markCache.delete(this.markCache.keys().next().value);
      this.markCache.set(key, footprintMark(width, depth, colour, fill, onset));
    }
    return instance(this.markCache.get(key), {origin: [x, 0, z], opacity: fill ? 0.29 : 1});
  }

  roomMark(room, colour, fill = false) {
    if (!room.sections) return this.mark(room.x, room.z, room.width, room.depth, colour, fill);
    const key = JSON.stringify([room.sections, colour, fill]);
    if (!this.markCache.has(key)) {
      if (this.markCache.size >= 24) this.markCache.delete(this.markCache.keys().next().value);
      this.markCache.set(key, roomOutline(room, colour, fill));
    }
    return instance(this.markCache.get(key), {opacity: fill ? 0.35 : 1});
  }

  doorway(x, z, axis, colour, opacity = 1) {
    const key = axis + colour;
    if (!this.markCache.has(key)) this.markCache.set(key, doorMark(axis, colour));
    return instance(this.markCache.get(key), {origin: [x, 0, z], opacity});
  }

  draw({house = emptyHouse, draftHouse = house, selection = null, preview = null, sweepX = null, levels, beat = null, time = 0} = {}) {
    this.lastRequest = {house, draftHouse, selection, preview, sweepX, levels, beat, time};
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const camera = this.updateCamera(rect);
    const changedSize = resize(this.target, rect.width, rect.height);
    const reducedMotion = this.motion?.matches ?? false;
    const drawing = reducedMotion ? 0 : Math.floor(time * 9) * 0.71 % (Math.PI * 200);
    const players = this.parade.frame(draftHouse, camera, time, beat, reducedMotion);
    const placement = previewKey(preview);
    const previous = this.lastFrame;
    if (!changedSize && previous?.camera === camera && previous.house === house && previous.draftHouse === draftHouse &&
        previous.selection === selection && previous.placement === placement && previous.sweepX === sweepX &&
        previous.players === players && previous.drawing === drawing && previous.reducedMotion === reducedMotion && sameLevels(levels, this.lastLevels)) return;
    this.lastFrame = {camera, house, draftHouse, selection, placement, sweepX, drawing, reducedMotion, players};
    this.lastLevels = new Map();
    if (levels) for (const [id, level] of levels) this.lastLevels.set(id, quantizedLevel(level));
    this.ground.inkOpacity = house.rooms.length ? 0.34 : 1;
    this.ground.origin = [Math.round(this.center[0] / 5) * 5, 0, Math.round(this.center[2] / 5) * 5];
    const items = [this.ground, this.origin];
    const rendered = this.architecture(house);
    items.push(instance(rendered.grounds, {canvasLayer: 1.5, canvasFlat: true, catchesSweep: false}));
    for (const floor of rendered.floors) items.push(instance(floor, {canvasLayer: 2}));
    items.push(instance(rendered.wallMesh, {canvasLayer: 3.25, canvasInkOffset: 0.2}));
    items.push(instance(rendered.entries, {canvasLayer: 3.5, canvasInkOffset: 0.2}));
    for (const piece of house.pieces) {
      items.push(...pieceItems(piece, {levels: this.lastLevels, level: this.lastLevels.get(piece.id) ?? 0, pose: reducedMotion ? 0 : 1}));
    }
    for (const player of players) items.push(marcherItem(player));

    const activeRooms = new Map(house.rooms.map(room => [room.id, room]));
    const activeDoors = new Map(house.doors.map(door => [door.id, door]));
    const activePieces = new Map(house.pieces.map(piece => [piece.id, piece]));
    if (draftHouse !== house) {
      draftHouse.rooms.forEach(room => {
        if (!samePlacement(activeRooms.get(room.id), room, 'rooms')) {
          items.push(this.roomMark(room, lavender, true));
        }
      });
      const draftRooms = new Map(draftHouse.rooms.map(room => [room.id, room]));
      for (const room of house.rooms) {
        if (!draftRooms.has(room.id)) items.push(this.roomMark(room, coral));
      }
      for (const piece of draftHouse.pieces) {
        if (!samePlacement(activePieces.get(piece.id), piece, 'pieces')) {
          items.push(...pieceItems(piece, {opacity: 0.48, tint: channels(lavender), tintAmount: 0.26}));
        }
      }
      const draftPieces = new Set(draftHouse.pieces.map(piece => piece.id));
      for (const piece of house.pieces) {
        if (!draftPieces.has(piece.id)) {
          const area = FloorPlan.footprint(piece);
          items.push(this.mark(area.x, area.z, area.width, area.depth, coral));
        }
      }
      for (const door of draftHouse.doors) {
        if (!samePlacement(activeDoors.get(door.id), door, 'doors')) {
          items.push(this.doorway(door.x, door.z, FloorPlan.doorAt(draftHouse, door)?.axis, lavender, 0.86));
        }
      }
      const draftDoors = new Set(draftHouse.doors.map(door => door.id));
      for (const door of house.doors) {
        if (!draftDoors.has(door.id)) items.push(this.doorway(door.x, door.z, FloorPlan.doorAt(house, door)?.axis, coral, 0.86));
      }
    }

    const selectedRoom = draftHouse.rooms.find(room => room.id === selection);
    const selectedPiece = draftHouse.pieces.find(piece => piece.id === selection);
    if (selectedRoom) items.push(this.roomMark(selectedRoom, yellow));
    const selectedArea = selectedPiece && FloorPlan.footprint(selectedPiece);
    if (selectedArea) items.push(this.mark(selectedArea.x, selectedArea.z, selectedArea.width, selectedArea.depth, yellow, false, Boolean(selectedPiece)));
    if (preview) {
      const colour = preview.valid ? blue : coral;
      if (preview.type === 'room') items.push(this.roomMark(preview, colour, true));
      if (preview.type === 'piece') {
        const area = FloorPlan.footprint(preview.piece);
        items.push(this.mark(area.x, area.z, area.width, area.depth, colour));
        items.push(...pieceItems(preview.piece, {opacity: 0.45, tint: channels(colour), tintAmount: 0.38}));
      }
      if (preview.type === 'door') items.push(this.doorway(preview.x, preview.z, preview.axis, colour));
    }

    if (sweepX !== null) {
      const intervals = house.rooms.flatMap(room => RoomShape.parts(room)).filter(room => room.x <= sweepX && sweepX <= room.x + room.width)
        .map(room => [room.z, room.z + room.depth]).sort(([a], [b]) => a - b);
      const spans = [];
      for (const interval of intervals) {
        const last = spans.at(-1);
        if (last && last[1] >= interval[0]) last[1] = Math.max(last[1], interval[1]);
        else spans.push(interval);
      }
      for (const [near, far] of spans) {
        items.push(instance(this.sweep, {
          origin: [sweepX, 0.087, (near + far) / 2], scale: [1, 1, (far - near) / 2],
          opacity: 0.68, wobble: 0
        }));
      }
    }
    this.renderer.draw(this.target, camera, items, {drawing, wobble: reducedMotion ? 0 : 0.8, sweepX});
  }
}
