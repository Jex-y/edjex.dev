import type { Component } from 'solid-js';
import styles from './navbar.module.css';

import type { NavLink } from './navgroup';
import Navgroup from './navgroup';

type NavbarProps = {
  left?: Array<NavLink>;
  right?: Array<NavLink>;
};

const Navbar: Component<NavbarProps> = ({ left = [], right = [] }) => {
  return (
    <nav class={styles.navbar}>
      <Navgroup links={left!} />
      <Navgroup links={right!} />
    </nav>
  );
};

export default Navbar;
