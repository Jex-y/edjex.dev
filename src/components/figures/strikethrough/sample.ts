export type Mark = 'plain' | 'strike' | 'underline';

export type Word = {
  text: string;
  mark: Mark;
};

export type OcrWord = Word & { ocr: string };

export type PlacedWord<W extends Word = Word> = W & {
  x: number;
  width: number;
  firstChar: number;
};

export const QUERY_WORDS: readonly Word[] = [
  { text: 'A', mark: 'plain' },
  { text: 'sealing', mark: 'strike' },
  { text: 'valve', mark: 'underline' },
  { text: 'body', mark: 'plain' },
];

export const QUERY_TEXT = QUERY_WORDS.map((word) => word.text).join(' ');

/** `ocr` must be the same length as `text`: garbled characters stay on the grid. */
const ocrWord = (text: string, mark: Mark, ocr: string = text): OcrWord => ({
  text,
  mark,
  ocr,
});

export const AMENDED_LINE: readonly OcrWord[] = [
  ocrWord('A', 'plain'),
  ocrWord('sealing', 'strike', 'se4l1ng'),
  ocrWord('valve', 'underline'),
  ocrWord('assembly', 'plain'),
  ocrWord('having', 'strike', 'hav1ng'),
  ocrWord('comprising', 'underline'),
  ocrWord('a', 'plain'),
  ocrWord('housing', 'plain'),
];

export const NEIGHBOUR_LINE =
  'a bore and a seat formed in the housing, wherein';

export const placeWords = <W extends Word>(
  words: readonly W[],
  x0: number,
  advance: number,
): readonly PlacedWord<W>[] =>
  words.reduce<readonly PlacedWord<W>[]>((placed, word) => {
    const last = placed.at(-1);
    const firstChar = last ? last.firstChar + last.text.length + 1 : 0;
    return [
      ...placed,
      {
        ...word,
        x: x0 + firstChar * advance,
        width: word.text.length * advance,
        firstChar,
      },
    ];
  }, []);

export const markColor = (mark: Mark) =>
  mark === 'strike' ? 'var(--st-strike)' : 'var(--st-underline)';

/** Illustrative bar heights in [0, 1]: stable across builds, deliberately not model output. */
export const illustrativeHeight = (marked: boolean, index: number) =>
  marked ? 0.82 + ((index * 7) % 5) * 0.04 : 0.05 + ((index * 3) % 4) * 0.025;

export const growFrames =
  (axis: 'X' | 'Y', duration: number) => (start: number) =>
    `0%, ${start}% { transform: scale${axis}(0); opacity: 1 } ${start + duration}%, 92% { transform: none; opacity: 1 } 97%, 100% { transform: none; opacity: 0 }`;
