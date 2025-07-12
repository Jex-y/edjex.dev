// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { remarkReadingTime } from './plugins/remark-reading-time.js';
import { remarkModifiedTime } from './plugins/remark-modified-time.js';
import { rehypeSectionize } from './plugins/rehype-sectionize.js';
import rehypeFigure from '@microflash/rehype-figure';
import rehypeSlug from 'rehype-slug';

import pdf from 'astro-pdf';

// https://astro.build/config
export default defineConfig({
        site: 'https://edjex.dev',
        integrations: [pdf({
                pages: {
                        '/cv': {
                                path: '/cv.pdf',
                                pdf: {
                                        format: 'A4',
                                        printBackground: true,
                                }
                        }
                },
                launch: { args: ['--no-sandbox',] },
        })],
        markdown: {
                remarkPlugins: [
                        remarkReadingTime,
                        remarkModifiedTime,

                ],
                rehypePlugins: [
                        rehypeSlug,
                        rehypeSectionize,
                        rehypeFigure,
                ]
        },

        vite: {
                plugins: [tailwindcss()],
        },
});
