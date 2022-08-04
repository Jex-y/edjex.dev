import type { Component } from 'solid-js';

import Terminal from './terminal';

import styles from './content.module.css';

const Content: Component = () => {
  return (
    <>
      <div class={styles.left}>
        <Terminal />
      </div>
    </>
  );
};

export default Content;
