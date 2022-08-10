import { Component, For } from 'solid-js';

import Terminal from '../features/terminal';
import Projects from '../features/projects';

import styles from './app.module.css';

const Content: Component = () => {
  return (
    <div class={styles.container}>
      <For each={[Terminal, Projects]}>
        {(Item) => {
          return <div class={styles.gridItem}>{Item({})}</div>;
        }}
      </For>
    </div>
  );
};

export default Content;
