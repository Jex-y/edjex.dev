import type { Component } from 'solid-js';

import styles from './socials.module.css';

import githubLogo from '../../../assets/GitHubLogo.svg';

const Socials: Component = () => {
  return (
    <div class={styles.socials}>
      <div class={styles.row}>
        <img src={githubLogo} />
        <h3>Jex-y</h3>
      </div>
    </div>
  );
};

export default Socials;
