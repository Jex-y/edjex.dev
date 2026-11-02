import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import Underline from '@tiptap/extension-underline';
import { CharacterCount, UndoRedo } from '@tiptap/extensions';
import type { Node } from '@tiptap/pm/model';
import type { Span } from './line';
import { codepoints, MAX_CHARACTERS } from './preprocessing';

const SingleLine = Document.extend({ content: 'paragraph' });

const textNode = ({ text, strike, underline }: Span) => ({
  type: 'text',
  text,
  marks: [
    ...(strike ? [{ type: 'strike' }] : []),
    ...(underline ? [{ type: 'underline' }] : []),
  ],
});

export const spansOf = (doc: Node): readonly Span[] =>
  (doc.firstChild?.content.content ?? []).map(({ text, marks }) => ({
    text: text ?? '',
    strike: marks.some(({ type }) => type.name === 'strike'),
    underline: marks.some(({ type }) => type.name === 'underline'),
  }));

export const createLineEditor = (
  element: HTMLElement,
  initial: readonly Span[],
): Editor =>
  new Editor({
    element,
    extensions: [
      SingleLine,
      Paragraph,
      Text,
      Strike,
      Underline,
      UndoRedo,
      CharacterCount.configure({
        limit: MAX_CHARACTERS,
        textCounter: (text) => codepoints(text).length,
      }),
    ],
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: initial.map(textNode) }],
    },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'A line of text for the model to read',
      },
      transformPastedText: (text) => text.replace(/\s+/g, ' '),
    },
  });
