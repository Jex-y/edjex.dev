import type { Component } from 'solid-js';
import { createSignal, createEffect } from 'solid-js';

import Command from './command';

import styles from './terminal.module.css';

import CONSTANTS from '../../../constants';

const terminal: Component = () => {
  const [getCommandIndex, setCommandIndex] = createSignal(-1);

  setTimeout(() => {
    console.log('called');
    setCommandIndex(0);
  }, CONSTANTS.START_DELAY);

  return (
    <div class={styles.terminal}>
      <div class={styles.top}>
        <div class={[styles.circle, styles.red].join(' ')} />
        <div class={[styles.circle, styles.yellow].join(' ')} />
        <div class={[styles.circle, styles.green].join(' ')} />
      </div>
      <Command command='whoami' getDisplay={() => getCommandIndex() >= 0}>
        <p>Hi, I am Ed Jex!</p>
      </Command>
    </div>
  );
};

export default terminal;
