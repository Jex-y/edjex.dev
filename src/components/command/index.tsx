import {
  JSX,
  Component,
  createSignal,
  createEffect,
  Show,
  onCleanup,
} from 'solid-js';

import styles from './command.module.css';

import CONSTANTS from '../../constants';

export type CommandProps = {
  command: string;
  getDisplay: () => boolean;
  startDelay?: number;
  typeDelay?: number;
  commandDelay?: number;
  onFinish?: () => void;
  children: JSX.Element;
};

const Command: Component<CommandProps> = ({
  command,
  getDisplay,
  children,
  onFinish = () => {},
  typeDelay = CONSTANTS.TYPE_DELAY,
  commandDelay = CONSTANTS.COMMAND_DELAY,
  startDelay,
}) => {
  const [getState, setState] = createSignal({
    pos: 0,
    done: false,
    started: false,
  });

  const [getcursorBlink, setCursorBlink] = createSignal(true);

  createEffect(() => {
    if (getDisplay() && startDelay && !getState().started) {
      setTimeout(() => {
        setState((prev) => ({ ...prev, started: true }));
      }, startDelay);
    }
  });

  const interval = setInterval(() => {
    setCursorBlink((prev) => !prev);
  }, CONSTANTS.CURSOR_BLINK);

  onCleanup(() => {
    clearInterval(interval);
  });

  createEffect(() => {
    const { pos, done, started } = getState();

    if (done || (!started && startDelay) || !getDisplay()) {
      return;
    }

    if (pos < command.length) {
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          pos: prev.pos + 1,
        }));
      }, typeDelay);
    } else {
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          done: true,
        }));
        onFinish();
      }, commandDelay);
    }
  });

  return (
    <Show when={getDisplay()}>
      <div class={styles.command}>
        <h4>
          {CONSTANTS.PROMPT_CHAR}{' '}
          {getState().done ? command : command.substring(0, getState().pos)}
          {!getState().done && getcursorBlink() ? '█' : ''}
        </h4>
        <Show when={getState().done}>{children}</Show>
      </div>
    </Show>
  );
};

export default Command;
