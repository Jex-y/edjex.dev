import {
  loadBackends,
  preferred,
  type Backend,
  type Backends,
} from './backend';
import { decode, heatmap, type Detection } from './decode';
import { INPUT_SIZE, LAYERS, OUTPUT_SIZE, OUTPUT_STRIDE } from './network';
import {
  diverging,
  drawMarker,
  loadImage,
  modelInput,
  paintGrid,
  sequential,
  type ModelInput,
  type Rgb,
} from './render';

type Stage = 'input' | 'conv1' | 'conv2' | 'head' | 'decode';
type ConvStage = 'conv1' | 'conv2';
type HeadView = 'heatmap' | 'offset y' | 'offset x';
type Toggle = 'cells' | 'offsets' | 'below' | 'heatmap';

type Frame = {
  readonly image: HTMLImageElement;
  readonly model: ModelInput;
  readonly layers: readonly Float32Array[];
  readonly scores: Float32Array;
  readonly peaks: readonly Detection[];
};

type State = {
  readonly frame: Frame | null;
  readonly stage: Stage;
  readonly channel: Readonly<Record<ConvStage, number>>;
  readonly head: HeadView;
  readonly threshold: number;
  readonly show: Readonly<Record<Toggle, boolean>>;
  readonly hot: number | null;
  readonly backend: Backend | null;
  readonly milliseconds: number | null;
};

const PLANE = OUTPUT_SIZE * OUTPUT_SIZE;
const PEAK_FLOOR = 0.05;
const BINS = 20;
const SHOWN_BELOW = 3;
const MARKER = 22;
const CONV_LAYER: Record<ConvStage, number> = { conv1: 0, conv2: 1 };
const HEAD_VIEWS: readonly HeadView[] = ['heatmap', 'offset y', 'offset x'];
const RUNS: Record<Backend['name'], number> = { WebGPU: 20, CPU: 3 };

const TOTAL_MACS = LAYERS.reduce(
  (sum, l) => sum + l.outChannels * l.outSize ** 2 * l.inChannels * 9,
  0,
);
const layerCost = (index: number) => {
  const l = LAYERS[index];
  const macs = l.outChannels * l.outSize ** 2 * l.inChannels * 9;
  return {
    parameters: l.outChannels * l.inChannels * 9 + l.outChannels,
    macs,
    share: macs / TOTAL_MACS,
  };
};

const STAGE_LAYER: Partial<Record<Stage, number>> = {
  conv1: 0,
  conv2: 1,
  head: 2,
};

const STAGE_TITLE: Record<Stage, string> = {
  input: 'Input',
  conv1: 'conv 3×3, stride 2',
  conv2: 'conv 3×3',
  head: 'head, conv 3×3',
  decode: 'Decode',
};

const STAGE_NOTE: Record<Stage, string> = {
  input:
    'The whole frame squashed to 192 × 192 and scaled to −1 to 1 per channel. Nothing else is done to it.',
  conv1:
    'The 48 channels after ReLU, each scaled to its own maximum. This layer also halves the resolution, which is all the downsampling the network does.',
  conv2:
    'The 24 channels after ReLU, each scaled to its own maximum. Faded channels never fire on this frame.',
  head: 'Three channels, no activation. The heatmap is shown after the sigmoid; the offsets say how far, in cells, each flea sits from its cell’s corner.',
  decode:
    'A sigmoid on the heatmap, a 3 × 3 max filter to keep only local peaks, the threshold, then each peak moves by its offset.',
};

const channel = (layer: Float32Array, index: number) =>
  layer.subarray(index * PLANE, (index + 1) * PLANE);

const maxOf = (values: Float32Array) =>
  values.reduce((max, v) => (v > max ? v : max), -Infinity);

const minOf = (values: Float32Array) =>
  values.reduce((min, v) => (v < min ? v : min), Infinity);

const variance = (values: Float32Array) => {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
};

const mostVaried = (layer: Float32Array, channels: number) =>
  Array.from({ length: channels }, (_, c) =>
    variance(channel(layer, c)),
  ).reduce((best, v, c, all) => (v > all[best] ? c : best), 0);

const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const fixed = (value: number, digits = 2) =>
  value.toFixed(digits).replace('-', '−');

const grouped = (value: number) => value.toLocaleString('en-GB');

const millions = (value: number) => `${(value / 1e6).toFixed(1)} M`;

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

const query = <T extends Element>(root: Element, role: string) => {
  const found = root.querySelector<T>(`[data-lab="${role}"]`);
  if (!found) throw new Error(`missing ${role}`);
  return found;
};

const toImageX = (frame: Frame, cells: number) =>
  ((cells * OUTPUT_STRIDE) / INPUT_SIZE) * frame.image.naturalWidth;

const toImageY = (frame: Frame, cells: number) =>
  ((cells * OUTPUT_STRIDE) / INPUT_SIZE) * frame.image.naturalHeight;

export const mountLab = (root: HTMLElement) => {
  const view = query<HTMLCanvasElement>(root, 'view');
  const tip = query<HTMLElement>(root, 'tip');
  const thumbs = query<HTMLElement>(root, 'thumbs');
  const upload = query<HTMLInputElement>(root, 'upload');
  const drop = query<HTMLElement>(root, 'drop');
  const slider = query<HTMLInputElement>(root, 'threshold');
  const thresholdValue = query<HTMLOutputElement>(root, 'threshold-value');
  const histogram = query<HTMLCanvasElement>(root, 'histogram');
  const gap = query<HTMLElement>(root, 'gap');
  const toggles = root.querySelectorAll<HTMLInputElement>('[data-toggle]');
  const rail = query<HTMLElement>(root, 'rail');
  const detail = query<HTMLElement>(root, 'detail');
  const stageNote = query<HTMLElement>(root, 'stage-note');
  const time = query<HTMLElement>(root, 'time');
  const timeNote = query<HTMLElement>(root, 'time-note');
  const backendButtons =
    root.querySelectorAll<HTMLButtonElement>('[data-backend]');
  const readout = query<HTMLElement>(root, 'readout');
  const points = query<HTMLTableSectionElement>(root, 'points');
  const weightsUrl = root.dataset.weights;
  if (!weightsUrl) return;

  let state: State = {
    frame: null,
    stage: 'decode',
    channel: { conv1: 0, conv2: 0 },
    head: 'heatmap',
    threshold: Number(slider.value),
    show: { cells: true, offsets: true, below: true, heatmap: false },
    hot: null,
    backend: null,
    milliseconds: null,
  };
  let backends: Backends | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let generation = 0;
  let channelsPainted: string | null = null;

  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  const fired = (s: State) =>
    s.frame?.peaks.filter((p) => p.score > s.threshold) ?? [];

  const paintView = (s: State) => {
    const frame = s.frame;
    const context = view.getContext('2d');
    if (!frame || !context) return;
    if (s.stage === 'input') {
      const data = frame.model.pixels.data;
      paintGrid(
        view,
        INPUT_SIZE,
        (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]] as Rgb,
      );
    } else if (s.stage === 'conv1' || s.stage === 'conv2') {
      const values = channel(
        frame.layers[CONV_LAYER[s.stage]],
        s.channel[s.stage],
      );
      const max = maxOf(values) || 1;
      paintGrid(view, OUTPUT_SIZE, (i) => sequential(values[i] / max));
    } else if (s.stage === 'head') {
      const output = frame.layers[2];
      if (s.head === 'heatmap') {
        paintGrid(view, OUTPUT_SIZE, (i) => sequential(frame.scores[i]));
      } else {
        const values = channel(output, s.head === 'offset y' ? 1 : 2);
        paintGrid(view, OUTPUT_SIZE, (i) => diverging(values[i] / 2 + 0.5));
      }
    } else {
      context.drawImage(frame.image, 0, 0, view.width, view.height);
      if (s.show.heatmap) {
        context.globalAlpha = 0.6;
        const overlay = document.createElement('canvas');
        overlay.width = view.width;
        overlay.height = view.height;
        paintGrid(overlay, OUTPUT_SIZE, (i) =>
          sequential(Math.sqrt(frame.scores[i])),
        );
        context.drawImage(overlay, 0, 0);
        context.globalAlpha = 1;
      }
      const shownBelow = new Set(
        frame.peaks.filter((p) => p.score <= s.threshold).slice(0, SHOWN_BELOW),
      );
      frame.peaks.forEach((peak, i) => {
        const above = peak.score > s.threshold;
        if (!above && !(s.show.below && shownBelow.has(peak))) return;
        drawMarker(context, peak, {
          size: MARKER,
          style: !above ? 'below' : i === s.hot ? 'hot' : 'fired',
          cell: s.show.cells || i === s.hot,
          offset: s.show.offsets,
        });
      });
    }
  };

  const defaultTip = (s: State) => {
    const frame = s.frame;
    if (!frame) return 'Loading the model…';
    if (s.stage === 'input') {
      return `192 × 192, from ${frame.image.naturalWidth} × ${frame.image.naturalHeight}`;
    }
    if (s.stage === 'conv1' || s.stage === 'conv2') {
      const count = LAYERS[CONV_LAYER[s.stage]].outChannels;
      const values = channel(
        frame.layers[CONV_LAYER[s.stage]],
        s.channel[s.stage],
      );
      return `channel ${s.channel[s.stage]} of ${count} · max ${fixed(maxOf(values))}`;
    }
    if (s.stage === 'head') {
      const values =
        s.head === 'heatmap'
          ? frame.scores
          : channel(frame.layers[2], s.head === 'offset y' ? 1 : 2);
      return `${s.head} · ${fixed(minOf(values))} to ${fixed(maxOf(values))}`;
    }
    const hot = s.hot === null ? null : frame.peaks[s.hot];
    return hot
      ? `${fixed(hot.score, 3)} · cell ${hot.row}, ${hot.col}`
      : `${fired(s).length} points above ${fixed(s.threshold)}`;
  };

  const paintHistogram = (s: State) => {
    const context = histogram.getContext('2d');
    if (!context) return;
    const { width, height } = histogram;
    context.clearRect(0, 0, width, height);
    const counts = Array.from({ length: BINS }, () => 0);
    s.frame?.peaks.forEach((p) => {
      counts[Math.min(BINS - 1, Math.floor(p.score * BINS))] += 1;
    });
    const tallest = Math.max(1, ...counts);
    const slot = width / BINS;
    counts.forEach((count, bin) => {
      const h = (count / tallest) * (height - 6);
      context.fillStyle =
        (bin + 0.5) / BINS > s.threshold ? '#14243d' : '#a7a7a7';
      context.fillRect(bin * slot + 1, height - h, slot - 4, h);
    });
    context.fillStyle = '#e07a1f';
    context.fillRect(s.threshold * width - 1.5, 0, 3, height);
  };

  const describeGap = (s: State) => {
    const peaks = s.frame?.peaks ?? [];
    const below = peaks.filter((p) => p.score <= s.threshold);
    const above = peaks.filter((p) => p.score > s.threshold);
    if (below.length === 0 || above.length === 0) {
      return 'Each bar counts the heatmap’s local peaks by score.';
    }
    const top = Math.max(...below.map((p) => p.score));
    const bottom = Math.min(...above.map((p) => p.score));
    return `Each bar counts the heatmap’s local peaks by score. None fall between ${fixed(top)} and ${fixed(bottom)}.`;
  };

  const paintRail = (s: State) => {
    rail.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.stage === s.stage));
    });
    const count = query<HTMLElement>(rail, 'decode-count');
    count.textContent = `${fired(s).length} points`;
  };

  const paintDetail = (s: State) => {
    const frame = s.frame;
    if (!frame) return;
    if (s.stage === 'conv1' || s.stage === 'conv2') {
      const stage = s.stage;
      const layer = frame.layers[CONV_LAYER[stage]];
      const count = LAYERS[CONV_LAYER[stage]].outChannels;
      const painted = `${stage}:${generation}`;
      if (channelsPainted !== painted) {
        detail.replaceChildren(
          ...Array.from({ length: count }, (_, c) => {
            const values = channel(layer, c);
            const max = maxOf(values);
            const canvas = element('canvas', { width: 24, height: 24 });
            paintGrid(canvas, OUTPUT_SIZE, (i) =>
              sequential(max > 0 ? values[i] / max : 0),
            );
            const button = element(
              'button',
              { type: 'button', title: `channel ${c}` },
              [canvas],
            );
            button.dataset.channel = String(c);
            button.classList.toggle('dead', max < 0.05);
            return button;
          }),
        );
        detail.className = 'lab-channels';
        channelsPainted = painted;
      }
      detail
        .querySelectorAll<HTMLButtonElement>('[data-channel]')
        .forEach((b) =>
          b.setAttribute(
            'aria-pressed',
            String(Number(b.dataset.channel) === s.channel[stage]),
          ),
        );
    } else if (s.stage === 'head') {
      channelsPainted = null;
      detail.className = 'lab-tabs';
      detail.replaceChildren(
        ...HEAD_VIEWS.map((name) => {
          const button = element('button', { type: 'button' }, [name]);
          button.dataset.head = name;
          button.setAttribute('aria-pressed', String(name === s.head));
          return button;
        }),
      );
    } else {
      channelsPainted = null;
      detail.className = '';
      detail.replaceChildren();
    }
    stageNote.textContent = STAGE_NOTE[s.stage];
  };

  const paintReadout = (s: State) => {
    const layer = STAGE_LAYER[s.stage];
    const title = element('p', { className: 'lab-label' }, [
      STAGE_TITLE[s.stage],
    ]);
    if (layer === undefined) {
      readout.replaceChildren(title);
      return;
    }
    const cost = layerCost(layer);
    const bar = element(
      'div',
      { className: 'lab-share' },
      LAYERS.map((_, i) => {
        const part = element('span');
        part.style.flexGrow = String(layerCost(i).share);
        part.classList.toggle('on', i === layer);
        return part;
      }),
    );
    readout.replaceChildren(
      title,
      element('p', { className: 'lab-num lab-ink' }, [
        `${grouped(cost.parameters)} parameters`,
        element('br'),
        `${millions(cost.macs)} multiply-adds`,
      ]),
      element('p', { className: 'lab-note' }, [
        `${Math.round(cost.share * 100)}% of the network’s arithmetic, of ${millions(TOTAL_MACS)} a frame:`,
      ]),
      bar,
      element('p', { className: 'lab-num lab-spread' }, [
        element('span', {}, ['conv 1']),
        element('span', {}, ['conv 2']),
        element('span', {}, ['head']),
      ]),
    );
  };

  const paintPoints = (s: State) => {
    const frame = s.frame;
    if (!frame) return;
    const above = frame.peaks.filter((p) => p.score > s.threshold);
    const below = frame.peaks
      .filter((p) => p.score <= s.threshold)
      .slice(0, SHOWN_BELOW);
    points.replaceChildren(
      ...[...above, ...below].map((peak) => {
        const index = frame.peaks.indexOf(peak);
        const row = element('tr', {}, [
          element('td', {}, [String(index + 1)]),
          element('td', {}, [fixed(peak.score, 3)]),
          element('td', {}, [String(Math.round(toImageX(frame, peak.x)))]),
          element('td', {}, [String(Math.round(toImageY(frame, peak.y)))]),
        ]);
        row.dataset.peak = String(index);
        row.classList.toggle('dim', peak.score <= s.threshold);
        row.classList.toggle('hot', index === s.hot);
        return row;
      }),
    );
  };

  const paintTiming = (s: State) => {
    backendButtons.forEach((b) => {
      const name = b.dataset.backend;
      b.disabled = name === 'WebGPU' ? !backends?.gpu : !backends;
      b.setAttribute('aria-pressed', String(name === s.backend?.name));
    });
    if (!s.backend) return;
    const runs = RUNS[s.backend.name];
    time.textContent =
      s.milliseconds === null ? '…' : `${s.milliseconds.toFixed(1)} ms`;
    timeNote.textContent =
      s.backend.name === 'WebGPU'
        ? `median of ${runs} runs, three compute passes on your GPU`
        : `median of ${runs} runs in plain JavaScript on your CPU`;
  };

  const render = (s: State) => {
    paintView(s);
    tip.textContent = defaultTip(s);
    paintHistogram(s);
    gap.textContent = describeGap(s);
    thresholdValue.value = fixed(s.threshold);
    paintRail(s);
    paintDetail(s);
    paintReadout(s);
    paintPoints(s);
    paintTiming(s);
    root.classList.toggle('ready', s.frame !== null);
  };

  const update = (patch: Partial<State>) => {
    state = { ...state, ...patch };
    render(state);
  };

  const measure = async (
    backend: Backend,
    input: Float32Array<ArrayBuffer>,
  ) => {
    const mine = generation;
    const samples: number[] = [];
    await exclusive(() => backend.run(input));
    for (let i = 0; i < RUNS[backend.name]; i++) {
      if (mine !== generation) return;
      samples.push(
        await exclusive(async () => {
          const start = performance.now();
          await backend.run(input);
          return performance.now() - start;
        }),
      );
    }
    if (mine === generation) update({ milliseconds: median(samples) });
  };

  const analyse = async (image: HTMLImageElement, backend: Backend) => {
    generation += 1;
    const mine = generation;
    const model = modelInput(image);
    const layers = await exclusive(() => backend.trace(model.input));
    if (mine !== generation) return;
    const output = layers[2];
    const scores = heatmap(output);
    const peaks = decode(output, scores, PEAK_FLOOR).sort(
      (a, b) => b.score - a.score,
    );
    const first = state.frame === null;
    update({
      frame: { image, model, layers, scores, peaks },
      backend,
      hot: null,
      milliseconds: null,
      channel: first
        ? {
            conv1: mostVaried(layers[0], LAYERS[0].outChannels),
            conv2: mostVaried(layers[1], LAYERS[1].outChannels),
          }
        : state.channel,
    });
    measure(backend, model.input);
  };

  const select = async (src: string) => {
    try {
      backends ??= await loadBackends(weightsUrl);
      thumbs.querySelectorAll<HTMLButtonElement>('[data-src]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.src === src));
      });
      await analyse(await loadImage(src), state.backend ?? preferred(backends));
    } catch {
      tip.textContent = 'The model could not run in this browser.';
    }
  };

  const addUpload = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const src = URL.createObjectURL(file);
    thumbs.querySelector('[data-upload]')?.remove();
    const image = element('img', { src, alt: file.name });
    const button = element('button', { type: 'button' }, [image]);
    button.dataset.src = src;
    button.dataset.upload = '';
    thumbs.insertBefore(button, drop);
    select(src);
  };

  const cellAt = (event: PointerEvent) => {
    const box = view.getBoundingClientRect();
    const u = (event.clientX - box.left) / box.width;
    const v = (event.clientY - box.top) / box.height;
    return { u, v };
  };

  view.addEventListener('pointermove', (event) => {
    const frame = state.frame;
    if (!frame) return;
    const { u, v } = cellAt(event);
    if (state.stage === 'decode') {
      const x = (u * INPUT_SIZE) / OUTPUT_STRIDE;
      const y = (v * INPUT_SIZE) / OUTPUT_STRIDE;
      const nearest = frame.peaks.reduce<{ i: number; d: number } | null>(
        (best, p, i) => {
          if (p.score <= state.threshold) return best;
          const d = Math.hypot(p.col + 0.5 - x, p.row + 0.5 - y);
          return d < 2.5 && (!best || d < best.d) ? { i, d } : best;
        },
        null,
      );
      if ((nearest?.i ?? null) !== state.hot)
        update({ hot: nearest?.i ?? null });
      return;
    }
    if (state.stage === 'input') {
      const col = Math.floor(u * INPUT_SIZE);
      const row = Math.floor(v * INPUT_SIZE);
      const d = frame.model.pixels.data;
      const i = (row * INPUT_SIZE + col) * 4;
      tip.textContent = `pixel ${row}, ${col} · rgb ${d[i]}, ${d[i + 1]}, ${d[i + 2]}`;
      return;
    }
    const col = Math.floor(u * OUTPUT_SIZE);
    const row = Math.floor(v * OUTPUT_SIZE);
    const i = row * OUTPUT_SIZE + col;
    const value =
      state.stage === 'conv1' || state.stage === 'conv2'
        ? channel(
            frame.layers[CONV_LAYER[state.stage]],
            state.channel[state.stage],
          )[i]
        : state.head === 'heatmap'
          ? frame.scores[i]
          : channel(frame.layers[2], state.head === 'offset y' ? 1 : 2)[i];
    tip.textContent = `cell ${row}, ${col} · ${fixed(value, 3)}`;
  });

  view.addEventListener('pointerleave', () => {
    if (state.stage === 'decode') update({ hot: null });
    else tip.textContent = defaultTip(state);
  });

  thumbs.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-src]',
    );
    if (button?.dataset.src) select(button.dataset.src);
  });

  upload.addEventListener('change', () => addUpload(upload.files?.[0]));
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('over');
    addUpload(event.dataTransfer?.files[0]);
  });

  slider.addEventListener('input', () =>
    update({ threshold: Number(slider.value), hot: null }),
  );

  toggles.forEach((input) =>
    input.addEventListener('change', () =>
      update({
        show: {
          ...state.show,
          [input.dataset.toggle as Toggle]: input.checked,
        },
      }),
    ),
  );

  rail.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      '[data-stage]',
    );
    if (button) update({ stage: button.dataset.stage as Stage, hot: null });
  });

  detail.addEventListener('click', (event) => {
    const target = event.target as Element;
    const channelButton = target.closest<HTMLButtonElement>('[data-channel]');
    const headButton = target.closest<HTMLButtonElement>('[data-head]');
    if (channelButton && (state.stage === 'conv1' || state.stage === 'conv2')) {
      update({
        channel: {
          ...state.channel,
          [state.stage]: Number(channelButton.dataset.channel),
        },
      });
    } else if (headButton) {
      update({ head: headButton.dataset.head as HeadView });
    }
  });

  points.addEventListener('pointerover', (event) => {
    const row = (event.target as Element).closest<HTMLElement>('[data-peak]');
    if (row) update({ hot: Number(row.dataset.peak) });
  });
  points.addEventListener('pointerleave', () => update({ hot: null }));

  backendButtons.forEach((button) =>
    button.addEventListener('click', () => {
      const next =
        button.dataset.backend === 'WebGPU' ? backends?.gpu : backends?.cpu;
      if (!next || !state.frame || next === state.backend) return;
      analyse(state.frame.image, next);
    }),
  );

  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    const first = thumbs.querySelector<HTMLButtonElement>('[data-src]');
    if (first?.dataset.src) select(first.dataset.src);
  }).observe(root);
};
