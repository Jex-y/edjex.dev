import { Component, For } from 'solid-js';
import projects from './projects';
import ProjectCard from '../../components/projectCard';

import styles from './projects.module.css';

const Projects: Component = () => {
  return (
    <div class={styles.grid}>
      <For each={projects}>
        {(item) => <ProjectCard user={item.user} repo={item.repo} />}
      </For>
    </div>
  );
};

export default Projects;
