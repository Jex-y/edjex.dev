import { JSX, Component, createSignal, createEffect, Show } from 'solid-js';

import styles from './command.module.css';

import CONSTANTS from '../../../../constants';

export type CommandProps = {
  command: string;
  getDisplay: () => boolean;
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
}) => {
  const [getState, setState] = createSignal({
    pos: 0,
    done: false,
  });

  createEffect(() => {
    const { pos, done } = getState();
    if (done) {
      return;
    }

    if (!getDisplay()) {
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
        </h4>
        <Show when={getState().done}>{children}</Show>
      </div>
    </Show>
  );
};

export default Command;
