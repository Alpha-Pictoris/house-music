// Each answer lasts a bar. A group of degrees sounds together.
export const responses = {
  chrome: [
    { fitting: 'glass', recording: 'talkbox', bars: [
      [[1.5, 2, 0.36, 0.92], [2, 2, 0.22, 0.79], [2.5, 0, 0.85, 1]],
      [[0.5, 2, 0.44, 0.91], [2.5, 0, 0.24, 0.84], [3, 0, 0.72, 1]]
    ] }
  ],
  moth: [
    { fitting: 'thorn', recording: 'low-chug', bars: [
      [[0, 0, 0.34, 1], [0.5, 0, 0.15, 0.83], [0.75, 0, 0.18, 0.90]],
      [[0, 0, 0.77, 1], [1, -1, 0.25, 0.83]]
    ] },
    { fitting: 'glass', recording: 'pipe-organ', bars: [
      [[1.5, 7, 0.35, 0.90], [2, 6, 0.33, 0.77], [2.5, 7, 0.76, 0.96]],
      []
    ] },
    { fitting: 'glass', recording: 'fuzz-lead', bars: [
      [],
      [[2.5, 4, 0.38, 0.84], [3, [0, 2], 0.83, 0.96]]
    ] }
  ],
  floorboards: [
    { fitting: 'thorn', recording: 'low-chug', bars: [
      [[0, 0, 0.22, 0.97], [0.75, 0, 0.14, 0.80], [2.75, 0, 0.36, 0.98]],
      [[0, 0, 0.59, 1], [1.5, 0, 0.18, 0.79], [3.5, -1, 0.19, 0.83]]
    ] },
    { fitting: 'glass', recording: 'gang-hit', bars: [
      [[1.5, 0, 0.31, 1], [3.5, 0, 0.24, 0.90]],
      [[2, 3, 0.44, 1]]
    ] }
  ],
  cassette: [
    { fitting: 'glass', recording: 'croon', bars: [
      [[0.08, 4, 0.76, 0.94], [1.10, 2, 0.40, 0.76], [1.61, 1, 1.53, 1]],
      [[0.08, 4, 0.75, 0.93], [1.10, 2, 0.40, 0.76], [1.61, 0, 1.87, 1]]
    ] },
    { fitting: 'thorn', recording: 'nylon', unless: 'thorn', bars: [
      [[3.5, 0, 0.45, 0.68]]
    ] }
  ],
  landing: [
    { fitting: 'glass', recording: 'horns', bars: [
      [[0.5, [2, 4], 0.21, 0.88], [0.875, 3, 0.19, 0.80], [1.25, [4, 7], 0.53, 1]],
      [[0, [2, 4], 0.37, 0.89], [0.75, 3, 0.20, 0.76], [1, [4, 7], 0.55, 0.96]]
    ] },
    { fitting: 'wire', recording: 'baritone', bars: [
      [[2, 4, 0.30, 0.91], [2.5, 2, 0.27, 0.81], [3.5, 0, 0.41, 0.89]],
      [[2, 0, 0.32, 0.89], [2.5, 1, 0.27, 0.76], [3, 2, 0.39, 0.92]]
    ] },
    { fitting: 'thorn', recording: 'upstroke', unless: 'thorn', bars: [
      [[0.5, 0, 0.14, 0.85], [1.5, 0, 0.15, 0.76], [2.5, 0, 0.14, 0.86], [3.5, 0, 0.15, 0.79]]
    ] }
  ]
};
