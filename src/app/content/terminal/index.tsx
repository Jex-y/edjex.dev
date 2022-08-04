import type { Component } from 'solid-js';
import { createSignal, createEffect } from 'solid-js';

import Command from './command';

import styles from './terminal.module.css';

import CONSTANTS from '../../../constants';

const terminal: Component = () => {
  return (
    <div class={styles.terminal}>
      <div class={styles.top}>
        <div class={[styles.circle, styles.red].join(' ')} />
        <div class={[styles.circle, styles.yellow].join(' ')} />
        <div class={[styles.circle, styles.green].join(' ')} />
      </div>
      <Command
        command='whoami'
        getDisplay={() => true}
        startDelay={CONSTANTS.START_DELAY}>
        <p>
          I am Ed Jex, a computer science student at Durham university. I am
          currenlty doing a summer internship at{' '}
          <a href={'https://www.cisco.com/'}>Cisco</a> where I am working on the{' '}
          <a href={'https://web.webex.com'}>Webex web client</a>.
        </p>
        <p>
          I love to work on personal projects in my free time. At the moment I
          am working on a social media platform through which I am learning to
          better use AWS serverless products.
        </p>
        <p>
          Recently, I worked on a project to measure the river level in Durham.
          It is still a work in progress as I have not yet deployed my own IoT
          sensor. This project is hosted at{' '}
          <a href='https://river-level.edjex.net'>river-level.edjex.net</a>{' '}
          where it is running on a AWS ECS service and using AWS cloudfront.
        </p>
      </Command>
    </div>
  );
};

export default terminal;
