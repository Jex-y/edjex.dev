import type { Component } from 'solid-js';
import { createSignal, createEffect } from 'solid-js';

import Command from '../../components/command';

import styles from './terminal.module.css';

import CONSTANTS from '../../constants';
import photo from '../../assets/profile.jpg';

const terminal: Component = () => {
  const [getCommandIndex, setCommandIndex] = createSignal(0);

  const onFinish = () => {
    setCommandIndex((prev) => prev + 1);
  };

  const experienceSince = (date: Date) => {
    const now = new Date();
    let diff = (now.getFullYear() - date.getFullYear()) * 12;
    diff += now.getMonth() - date.getMonth();

    if (diff < 1) {
      return `Less than a month`;
    } else if (diff < 12) {
      return `${diff} months`;
    } else if (diff < 60) {
      return `${Math.floor(diff / 12)} years, ${diff % 12} months`;
    } else {
      return `${Math.floor(diff / 12)} years`;
    }
  };

  return (
    <div class={styles.terminal}>
      <div class={styles.top}>
        <div class={[styles.circle, styles.red].join(' ')} />
        <div class={[styles.circle, styles.yellow].join(' ')} />
        <div class={[styles.circle, styles.green].join(' ')} />
      </div>
      <Command
        command='whoami'
        getDisplay={() => getCommandIndex() >= 0}
        startDelay={CONSTANTS.START_DELAY}
        onFinish={onFinish}>
        <p>
          Ed Jex, a computer science student at Durham university and software
          developer
        </p>
      </Command>
      <Command
        command='neofetch'
        getDisplay={() => getCommandIndex() >= 1}
        startDelay={CONSTANTS.START_DELAY}
        onFinish={onFinish}>
        <div class={styles.neofetch}>
          <img src={photo} alt='Ed Jex' />
          <div>
            <a href='mailto:edwardjex@live.co.uk'>edwardjex@live.co.uk</a>
            <span>
              JavaScript/Typescript: {experienceSince(CONSTANTS.JS_LEARN_DATE)}
            </span>
            <span class={styles.subskill}>React</span>
            <span class={styles.subskill}>Redux</span>
            <span>Python: {experienceSince(CONSTANTS.PY_LEARN_DATE)}</span>
            <span class={styles.subskill}>Numpy</span>
            <span class={styles.subskill}>TensorFlow</span>
            <span>AWS: {experienceSince(CONSTANTS.AWS_LEARN_DATE)}</span>
            <span>CI/CD: {experienceSince(CONSTANTS.JS_LEARN_DATE)}</span>
          </div>
        </div>
      </Command>
      <Command
        command={`man 'Ed Jex'`}
        getDisplay={() => getCommandIndex() >= 2}
        startDelay={CONSTANTS.START_DELAY}
        onFinish={onFinish}>
        <div class={styles.man}>
          <h5>EXPERIENCE & QUALIFICATIONS</h5>
          <p>
            I am current completing a software engineering internship at Cisco
            where I am working on the{' '}
            <a href='https://web.webex.com'>Webex web app</a> using React,
            Redux, and Typescript.
          </p>
          <p>
            In the first year of my degree I achieved firsts in all of my
            modules. For my programming module coursework I created{' '}
            <a href='https://river-level.edjex.net'>river-level.edjex.net</a>.
            At school, I got A*s in Maths, Further Maths, Physics, and Computer
            Science at A-Level.
          </p>
        </div>
      </Command>
      <Command
        command='ls -la ./contact'
        getDisplay={() => getCommandIndex() >= 3}
        startDelay={CONSTANTS.START_DELAY}
        onFinish={onFinish}>
        <div class={styles.contact}>
          <span>GitHub</span>
          <a href='https://github.com/Jex-y'>Jex-y</a>
          <span>LinkedIn</span>
          <a href='https://www.linkedin.com/in/edward-jex/'>Edward Jex</a>
        </div>
      </Command>
    </div>
  );
};

export default terminal;
