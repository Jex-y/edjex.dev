import type { APIRoute } from 'astro';
import { sitePath } from '../lib/paths';

export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *
Allow: /

Sitemap: ${new URL(sitePath('/sitemap-index.xml'), site)}
`,
  );
