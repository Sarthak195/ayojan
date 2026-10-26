// Unicode NFC with a map back to the original, so "हज़ार" typed with a precomposed letter
// matches the same word typed as letter plus nukta, while a highlight still lands on the
// characters the user typed. NFC can lengthen or shorten text, so it is applied per chunk:
// a chunk that NFC leaves alone maps one to one, and a chunk it changes maps every output
// unit to the whole input chunk it came from.

import { isWhitespace } from './character-class';

export interface MappedText {
  readonly text: string;
  /** For each UTF-16 unit of `text`, the start of the original range it came from. */
  readonly starts: readonly number[];
  /** For each UTF-16 unit of `text`, the end (exclusive) of the original range it came from. */
  readonly ends: readonly number[];
}

interface Sink {
  readonly parts: string[];
  readonly starts: number[];
  readonly ends: number[];
}

const MARK = /\p{M}/u;

function emitMapped(sink: Sink, piece: string, start: number, end: number): void {
  sink.parts.push(piece);
  for (let remaining = piece.length; remaining > 0; remaining -= 1) {
    sink.starts.push(start);
    sink.ends.push(end);
  }
}

function emitIdentity(sink: Sink, piece: string, offset: number): void {
  sink.parts.push(piece);
  for (let unit = 0; unit < piece.length; unit += 1) {
    sink.starts.push(offset + unit);
    sink.ends.push(offset + unit + 1);
  }
}

// One code point plus the combining marks after it: the unit NFC composes in almost every
// script. Returns the clusters with their offsets inside `word`.
function clusters(word: string): { text: string; offset: number }[] {
  const found: { text: string; offset: number }[] = [];
  let offset = 0;
  for (const character of word) {
    const last = found.at(-1);
    if (last !== undefined && MARK.test(character)) {
      found[found.length - 1] = { text: last.text + character, offset: last.offset };
    } else {
      found.push({ text: character, offset });
    }
    offset += character.length;
  }
  return found;
}

// A word NFC changes is mapped cluster by cluster when that reproduces NFC of the word
// exactly; the rare scripts that compose across clusters (Hangul jamo) fall back to mapping
// the whole word, which is coarser but never wrong.
function emitChangedWord(sink: Sink, word: string, wordStart: number, normal: string): void {
  const pieces = clusters(word).map((cluster) => ({
    cluster,
    normal: cluster.text.normalize('NFC'),
  }));
  if (pieces.map((piece) => piece.normal).join('') !== normal) {
    emitMapped(sink, normal, wordStart, wordStart + word.length);
    return;
  }
  for (const piece of pieces) {
    const start = wordStart + piece.cluster.offset;
    if (piece.normal === piece.cluster.text) emitIdentity(sink, piece.normal, start);
    else emitMapped(sink, piece.normal, start, start + piece.cluster.text.length);
  }
}

function emitWord(sink: Sink, word: string, wordStart: number): void {
  const normal = word.normalize('NFC');
  if (normal === word) emitIdentity(sink, word, wordStart);
  else emitChangedWord(sink, word, wordStart, normal);
}

/** NFC of `original`, with every output unit mapped to the original range it came from. */
export function normalForm(original: string): MappedText {
  const sink: Sink = { parts: [], starts: [], ends: [] };
  // Whitespace never takes part in a composition, so words between whitespace are
  // independent and each is normalised on its own.
  let wordStart = 0;
  for (let index = 0; index <= original.length; index += 1) {
    const atEnd = index === original.length;
    if (!atEnd && !isWhitespace(original.charCodeAt(index))) continue;
    if (index > wordStart) emitWord(sink, original.slice(wordStart, index), wordStart);
    if (!atEnd) emitIdentity(sink, original.charAt(index), index);
    wordStart = index + 1;
  }
  return { text: sink.parts.join(''), starts: sink.starts, ends: sink.ends };
}
