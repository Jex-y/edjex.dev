import type { Component } from 'solid-js';
import { Show, For } from 'solid-js';
import styles from './navgroup.module.css';

export type NavLink = {
  label: string;
  href: string;
};

type NavGroupProps = { links: Array<NavLink> };

const Navgroup: Component<NavGroupProps> = ({ links }) => {
  return (
    <div class={styles.navgroup}>
      <For each={links}>
        {({ label, href }) => (
          <a class={styles.navLink} href={href}>
            {label}
          </a>
        )}
      </For>
    </div>
  );
};

export default Navgroup;
