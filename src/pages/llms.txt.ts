import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  EMAIL,
  GITHUB_URL,
  LINKEDIN_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from '../consts';
import { sitePath } from '../lib/paths';

// https://llmstxt.org
export const GET: APIRoute = async ({ site }) => {
  const url = (path: `/${string}`) => new URL(sitePath(path), site).href;
  const posts = (
    await getCollection(
      'blog',
      ({ data }) => data.draft !== true && data.pubDate <= new Date(),
    )
  ).sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return new Response(`# ${SITE_TITLE}

> ${SITE_DESCRIPTION}

- Software engineer at Solve Intelligence since 2025. Took Charts, an agentic spreadsheet product for IP search and analysis, from prototype to production, and built the infrastructure that runs the platform's background agents.
- MEng Computer Science, Durham University, first class, top of the year.
- Web development intern at Cisco on the Webex web client, summer 2022.
- Contact: ${EMAIL}

## Pages

- [Home](${url('/')}): work, research and projects
- [CV](${url('/cv')}): also as a [PDF](${url('/cv.pdf')})

## Writing

${posts.map(({ id, data }) => `- [${data.title}](${url(`/blog/${id}/`)}): ${data.description}`).join('\n')}

## Elsewhere

- [GitHub](${GITHUB_URL})
- [LinkedIn](${LINKEDIN_URL})
- [River Wear forecast](https://river.edjex.dev)
`);
};
