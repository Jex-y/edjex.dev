const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Resolves a root-relative path against the deploy base, which is not `/` on a branch preview. */
export const sitePath = (path: `/${string}`): string => `${base}${path}`;
