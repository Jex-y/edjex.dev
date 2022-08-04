import type { Component } from 'solid-js';

import Terminal from './terminal';
import Socials from './socials';

import styles from './content.module.css';

const Content: Component = () => {
  return (
    <>
      <div class={styles.left}>
        <Terminal />
        {/* <Socials /> */}
      </div>
      <div class={styles.right}>{/* <Projects /> */}</div>
    </>
  );
};

export default Content;
