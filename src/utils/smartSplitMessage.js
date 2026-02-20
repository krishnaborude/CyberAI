const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;
const SPLIT_TRIGGER = 1900;
const TARGET_CHUNK_SIZE = 1600;
const HARD_MAX = 1900;

function restorePlaceholders(input, placeholders) {
  let text = input;
  for (const [token, value] of placeholders.entries()) {
    text = text.replaceAll(token, value);
  }
  return text;
}

function protectCodeBlocks(text) {
  const placeholders = new Map();
  let index = 0;

  const protectedText = text.replace(CODE_BLOCK_REGEX, (block) => {
    const token = `__CODE_BLOCK_${index++}__`;
    placeholders.set(token, block);
    return token;
  });

  return { protectedText, placeholders };
}

function splitByHeadings(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = '';

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && current.trim()) {
      sections.push(current.trim());
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }

  if (current.trim()) sections.push(current.trim());
  return sections.filter(Boolean);
}

function splitByParagraphs(text) {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitBySentence(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9#*`-])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitByCodeTokens(text) {
  return text
    .split(/(__CODE_BLOCK_\d+__)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function segmentText(text) {
  const headingSections = splitByHeadings(text);
  if (headingSections.length > 1) return headingSections;

  const paragraphs = splitByParagraphs(text);
  if (paragraphs.length > 0) return paragraphs;

  return [text];
}

function packSegments(segments, maxLen) {
  const chunks = [];
  let current = '';

  for (const segment of segments) {
    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (segment.length <= maxLen) {
      current = segment;
      continue;
    }

    // If a heading section is too large, split by paragraph boundaries first
    // to avoid cutting structured rows/lists in awkward places.
    const paragraphParts = splitByParagraphs(segment);
    if (paragraphParts.length > 1) {
      const subChunks = packSegments(paragraphParts, maxLen);
      if (subChunks.length > 0) {
        chunks.push(...subChunks);
        continue;
      }
    }

    const sentenceParts = splitBySentence(segment);
    if (sentenceParts.length === 0) {
      chunks.push(segment.slice(0, maxLen));
      continue;
    }

    let sentenceChunk = '';
    for (const sentence of sentenceParts) {
      const sentenceCandidate = sentenceChunk ? `${sentenceChunk}\n${sentence}` : sentence;
      if (sentenceCandidate.length <= maxLen) {
        sentenceChunk = sentenceCandidate;
      } else {
        if (sentenceChunk) chunks.push(sentenceChunk);
        if (sentence.length <= maxLen) {
          sentenceChunk = sentence;
          continue;
        }

        const words = sentence.split(/\s+/).filter(Boolean);
        let wordChunk = '';
        for (const word of words) {
          const wordCandidate = wordChunk ? `${wordChunk} ${word}` : word;
          if (wordCandidate.length <= maxLen) {
            wordChunk = wordCandidate;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            if (word.length <= maxLen) {
              wordChunk = word;
              continue;
            }

            let index = 0;
            while (index < word.length) {
              const slice = word.slice(index, index + maxLen);
              if (slice.length === maxLen) {
                chunks.push(slice);
              } else {
                wordChunk = slice;
              }
              index += maxLen;
            }
          }
        }
        sentenceChunk = wordChunk;
      }
    }

    if (sentenceChunk) {
      current = sentenceChunk;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function forceMinimumChunks(text, minChunks) {
  const { protectedText, placeholders } = protectCodeBlocks(text);
  let segments = segmentText(protectedText);

  if (segments.length < minChunks) {
    segments = splitBySentence(protectedText);
  }

  const targetSize = Math.max(700, Math.ceil(protectedText.length / minChunks));
  const packed = packSegments(segments, Math.min(targetSize, TARGET_CHUNK_SIZE));

  return packed
    .map((chunk) => restorePlaceholders(chunk, placeholders))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function enforceHardLimit(chunks) {
  const safeChunks = [];

  for (const chunk of chunks) {
    if (chunk.length <= HARD_MAX) {
      safeChunks.push(chunk);
      continue;
    }

    const { protectedText, placeholders } = protectCodeBlocks(chunk);
    const parts = splitByCodeTokens(protectedText);
    let current = '';

    for (const part of parts) {
      const restored = restorePlaceholders(part, placeholders);
      const safePart = restored.length > HARD_MAX && restored.startsWith('```')
        ? '```text\n[Code block omitted: output exceeded Discord message limits. Ask for a shorter snippet.]\n```'
        : restored;

      const candidate = current ? `${current}\n\n${safePart}` : safePart;
      if (candidate.length <= HARD_MAX) {
        current = candidate;
      } else {
        if (current) safeChunks.push(current);
        current = safePart.length <= HARD_MAX ? safePart : safePart.slice(0, HARD_MAX);
      }
    }

    if (current) {
      safeChunks.push(current);
    }
  }

  return safeChunks;
}

function mergeChunksForReadability(chunks, maxChunks) {
  if (!Array.isArray(chunks) || chunks.length <= 1) return chunks;

  const merged = [...chunks];

  const mergePair = (index) => {
    const combined = `${merged[index]}\n\n${merged[index + 1]}`.trim();
    merged.splice(index, 2, combined);
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length - 1; i += 1) {
      const combinedLen = merged[i].length + 2 + merged[i + 1].length;
      if (merged[i].length < 350 && combinedLen <= HARD_MAX) {
        mergePair(i);
        changed = true;
        break;
      }
    }
  }

  while (merged.length > maxChunks) {
    let bestIndex = -1;
    let bestLength = Number.POSITIVE_INFINITY;

    for (let i = 0; i < merged.length - 1; i += 1) {
      const combinedLen = merged[i].length + 2 + merged[i + 1].length;
      if (combinedLen <= HARD_MAX && combinedLen < bestLength) {
        bestLength = combinedLen;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;
    mergePair(bestIndex);
  }

  if (merged.length > 1) {
    const last = merged.length - 1;
    const combineTail = merged[last - 1].length + 2 + merged[last].length;
    if (merged[last].length < 280 && combineTail <= HARD_MAX) {
      mergePair(last - 1);
    }
  }

  return merged;
}

function smartSplitMessage(input, options = {}) {
  const minChunks = Number.isInteger(options.minChunks) && options.minChunks > 0 ? options.minChunks : 1;
  const maxChunks = Number.isInteger(options.maxChunks) && options.maxChunks >= minChunks ? options.maxChunks : 3;
  // Default on: chunk banners help users know the message continues.
  // Disable explicitly with { addPageHeader: false } if needed.
  const addPageHeader = options.addPageHeader !== false;

  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return ['No response generated.'];
  if (text.length <= SPLIT_TRIGGER && minChunks <= 1) return [text];

  const { protectedText, placeholders } = protectCodeBlocks(text);
  const segments = segmentText(protectedText);
  const packed = packSegments(segments, TARGET_CHUNK_SIZE);

  const restored = packed
    .map((chunk) => restorePlaceholders(chunk, placeholders))
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  let finalized = enforceHardLimit(restored);

  if (finalized.length < minChunks && text.length > 900) {
    finalized = enforceHardLimit(forceMinimumChunks(text, minChunks));
  }

  finalized = mergeChunksForReadability(finalized, maxChunks);

  if (finalized.length <= 1) return finalized;
  if (!addPageHeader) return finalized;

  return finalized.map((chunk, index) => {
    const page = `**\u{1F4D8} CyberAI Response (${index + 1}/${finalized.length})**`;
    return `${page}\n\n${chunk}`;
  });
}

module.exports = {
  smartSplitMessage
};
