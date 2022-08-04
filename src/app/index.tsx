import type { Component } from 'solid-js';

import Navbar from './navbar';
import Content from './content';

import styles from './app.module.css';

const App: Component = () => {
  return (
    <>
      <Navbar
        left={[
          {
            label: 'About',
            href: '#about',
          },
        ]}
        right={[
          {
            label: 'Contact',
            href: '#',
          },
        ]}
      />
      <div class={styles.container}>
        <Content />
      </div>
    </>
  );
};

export default App;
