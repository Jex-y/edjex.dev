export const LOOP_SECONDS = 10;

export const keyframes = (
  name: string,
  starts: readonly number[],
  frames: (start: number) => string,
) =>
  [...new Set(starts)]
    .map((start) => `@keyframes ${name}-${start} { ${frames(start)} }`)
    .join('\n');

export const appear = (start: number) =>
  `0%, ${start}% { opacity: 0 } ${start + 3}%, 92% { opacity: 1 } 97%, 100% { opacity: 0 }`;

export const travel = (start: number) =>
  `0%, ${start}% { stroke-dashoffset: 12 } ${start + 7}%, 100% { stroke-dashoffset: -100 }`;

export const grow = (start: number) =>
  `0%, ${start}% { transform: scaleX(0) } ${start + 5}%, 100% { transform: none }`;
