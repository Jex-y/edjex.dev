export const playWhenVisible = (root: Element) =>
  new IntersectionObserver(([entry]) =>
    root.classList.toggle('playing', entry.isIntersecting),
  ).observe(root);
