// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { remarkReadingTime } from './plugins/remark-reading-time.js';
import { remarkModifiedTime } from './plugins/remark-modified-time.js';
import rehypeFigure from '@microflash/rehype-figure';
import rehypeSlug from 'rehype-slug';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import pdf from 'astro-pdf';
import { CV_EMAIL } from './src/consts';



const base = process.env.PREVIEW_BASE ?? '/';

// https://astro.build/config
export default defineConfig({
        site: 'https://edjex.dev',
        base,
        integrations: [mdx(), sitemap(), pdf({
                pages: {
                        [`${base}cv`]: {
                                path: '/cv.pdf',
                                // Tag links back to the site so visits from the PDF show up in analytics
                                callback: async (page) => {
                                        await page.$$eval('a[href^="https://edjex.dev"]', (links) => {
                                                for (const link of links) {
                                                        const url = new URL(link.href);
                                                        url.searchParams.set('utm_source', 'cv-pdf');
                                                        url.searchParams.set('utm_medium', 'pdf');
                                                        url.searchParams.set('utm_campaign', 'nov-26');
                                                        link.href = url.href;
                                                }
                                        });
                                        await page.$eval('[data-email]', (item, address) => {
                                                const link = document.createElement('a');
                                                link.href = `mailto:${address}`;
                                                link.textContent = address;
                                                item.replaceChildren(link);
                                        }, CV_EMAIL);
                                },
                                pdf: {
                                        format: 'A4',
                                        printBackground: true,
                                        tagged: true,
                                        outline: true,
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
