// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { remarkReadingTime } from './plugins/remark-reading-time.js';
import { remarkModifiedTime } from './plugins/remark-modified-time.js';
import rehypeFigure from '@microflash/rehype-figure';
import rehypeSlug from 'rehype-slug';

import mdx from '@astrojs/mdx';
import pdf from 'astro-pdf';



const base = process.env.PREVIEW_BASE ?? '/';

// https://astro.build/config
export default defineConfig({
        site: 'https://edjex.dev',
        base,
        integrations: [mdx(), pdf({
                pages: {
                        [`${base}cv`]: {
                                path: '/cv.pdf',
                                pdf: {
                                        format: 'A4',
                                        printBackground: true,
                                }
                        }
                },
                launch: { args: ['--no-sandbox',] },
        }),],
        markdown: {
                remarkPlugins: [
                        remarkReadingTime,
                        remarkModifiedTime,

                ],
                rehypePlugins: [
                        rehypeSlug,
                        rehypeFigure,
                ]
        },

        vite: {
                plugins: [tailwindcss()],
        },
});
