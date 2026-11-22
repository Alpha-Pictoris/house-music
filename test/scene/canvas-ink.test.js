import test from 'node:test';
import assert from 'node:assert/strict';
import {CanvasInkRenderer} from '../../web/scene/canvas-ink-renderer.js';
import {HouseScene} from '../../web/scene/house-scene.js';
import {InkMesh, instance} from '../../web/scene/ink-mesh.js';

const camera = {width: 24, height: 16, eye: [0,0,1], project: ([x,y]) => ({x,y})};

function sheet(leftDepth, rightDepth, colour, opacity = 1) {
  const mesh = new InkMesh();
  mesh.face([[2,2,leftDepth], [22,2,rightDepth], [22,14,rightDepth], [2,14,leftDepth]], colour);
  return instance(mesh, {opacity});
}

function canvas(width, height) {
  let image;
  const ctx = {
    createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}),
    putImageData: pixels => { image = pixels.data; }
  };
  return {
    width, height, dataset: {}, getContext: type => type === '2d' ? ctx : null,
    getBoundingClientRect: () => ({left: 0, top: 0, width, height}),
    pixel(x, y) {
      const start = 4 * (Math.floor(y) * width + Math.floor(x));
      return Array.from(image.subarray(start, start + 4));
    }
  };
}

function render(items, scale = 1) {
  const plot = canvas(camera.width * scale, camera.height * scale);
  const renderer = new CanvasInkRenderer(plot.getContext('2d'));
  renderer.draw(plot, camera, items, {wobble: 0, drawing: 0});
  return (x, y) => plot.pixel(x * scale, y * scale);
}

test('crossing faces hide each other on opposite sides in either draw order', () => {
  const red = sheet(-2, 2, '#ff0000'), blue = sheet(0, 0, '#0000ff');
  for (const pieces of [[red, blue], [blue, red]]) {
    const pixel = render(pieces);
    assert.deepEqual(pixel(7, 8), [0, 0, 255, 255]);
    assert.deepEqual(pixel(17, 8), [255, 0, 0, 255]);
  }
});

test('only the part of an outline in front of a wall shows', () => {
  const mesh = new InkMesh(40);
  mesh.segment([1,8,-2], [23,8,2], '#00ff00', 2.5);
  for (const scale of [1, 2]) {
    const pixel = render([instance(mesh), sheet(0, 0, '#0000ff')], scale);
    assert.deepEqual(pixel(7, 8), [0, 0, 255, 255]);
    assert.deepEqual(pixel(17, 8), [0, 255, 0, 255]);
  }
});

test('placement previews blend in front of a wall and disappear behind it', () => {
  const pixel = render([sheet(-2, 2, '#ff0000', 0.5), sheet(0, 0, '#0000ff')]);
  assert.deepEqual(pixel(7, 8), [0, 0, 255, 255]);
  assert.deepEqual(pixel(17, 8), [128, 0, 128, 255]);
  assert.deepEqual(pixel(0, 0), [0, 0, 0, 0]);
});

test('a garden path disappears behind a newly built room', () => {
  const plot = canvas(280, 206), scene = new HouseScene(plot);
  const stone = {id: 'stone', kind: 'path', x: 1, z: -1.05, turn: 0};
  const room = {id: 'parlour', x: 0, z: 0, width: 4, depth: 3, finish: 'walnut'};
  const garden = {rooms: [], pieces: [stone], doors: [], band: false};
  const house = {...garden, rooms: [room]};
  scene.fit(house);
  const {x, y} = scene.screenAt({x: 1.5, z: -0.82}, 0.009);
  scene.draw({house: garden});
  const flagstone = plot.pixel(x, y);
  scene.draw({house: {...house, pieces: []}});
  const wall = plot.pixel(x, y);
  scene.draw({house});
  assert.notDeepEqual(wall, flagstone);
  assert.deepEqual(plot.pixel(x, y), wall);
});
