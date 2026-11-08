// Fails when dist/cv.pdf's text layer does not read, word for word and in
// order, as the CV page it was printed from. Run after `npm run build`.
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { CV_EMAIL, EMAIL } from '../src/consts.ts';

const words = (text) => text.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];

const pageWords = async () => {
  const html = await readFile('dist/cv/index.html', 'utf8');
  const cv = html.slice(html.indexOf('<div id="cv"'), html.indexOf('</main>'));
  const text = cv
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&')
    .replaceAll(EMAIL, CV_EMAIL);
  return words(text);
};

const pdfWords = async () => {
  const pdf = await getDocument({
    data: new Uint8Array(await readFile('dist/cv.pdf')),
  }).promise;
  if (pdf.numPages !== 1)
    throw new Error(`cv.pdf has ${pdf.numPages} pages, expected 1`);
  const content = await (await pdf.getPage(1)).getTextContent();
  return words(
    content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
  );
};

const expected = await pageWords();
const actual = await pdfWords();
const first = expected.findIndex((word, i) => word !== actual[i]);

if (first !== -1 || expected.length !== actual.length) {
  const at = first === -1 ? Math.min(expected.length, actual.length) : first;
  console.error(`cv.pdf text diverges from the page at word ${at}:`);
  console.error(`  page: ${expected.slice(at, at + 12).join(' ')}`);
  console.error(`  pdf:  ${actual.slice(at, at + 12).join(' ')}`);
  process.exit(1);
}
console.log(`cv.pdf text layer matches the page (${actual.length} words)`);
