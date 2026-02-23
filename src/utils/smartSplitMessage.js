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

  const minTargetSize = minChunks >= 4 ? 220 : 700;
  const targetSize = Math.max(minTargetSize, Math.ceil(protectedText.length / minChunks));
  const packed = packSegments(segments, Math.min(targetSize, TARGET_CHUNK_SIZE));

  return packed
    .map((chunk) => restorePlaceholders(chunk, placeholders))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function splitBalanced(parts, separator, targetLen) {
  if (!Array.isArray(parts) || parts.length < 2) return [];
  const clean = parts.map((part) => part.trim()).filter(Boolean);
  if (clean.length < 2) return [];

  let index = 1;
  let currentLen = clean[0].length;
  while (index < clean.length - 1 && currentLen + separator.length + clean[index].length < targetLen) {
    currentLen += separator.length + clean[index].length;
    index += 1;
  }

  const left = clean.slice(0, index).join(separator).trim();
  const right = clean.slice(index).join(separator).trim();
  if (!left || !right) return [];
  return [left, right];
}

function splitChunkForMinimum(chunk) {
  if (typeof chunk !== 'string' || chunk.length < 2) return [chunk];

  const { protectedText, placeholders } = protectCodeBlocks(chunk);
  const targetLen = Math.max(120, Math.floor(protectedText.length / 2));

  const paragraphParts = splitBalanced(splitByParagraphs(protectedText), '\n\n', targetLen);
  if (paragraphParts.length === 2) {
    return paragraphParts.map((part) => restorePlaceholders(part, placeholders).trim()).filter(Boolean);
  }

  const sentenceParts = splitBalanced(splitBySentence(protectedText), '\n', targetLen);
  if (sentenceParts.length === 2) {
    return sentenceParts.map((part) => restorePlaceholders(part, placeholders).trim()).filter(Boolean);
  }

  const lineParts = splitBalanced(
    protectedText.split('\n').map((line) => line.trim()).filter(Boolean),
    '\n',
    targetLen
  );
  if (lineParts.length === 2) {
    return lineParts.map((part) => restorePlaceholders(part, placeholders).trim()).filter(Boolean);
  }

  if (/__CODE_BLOCK_\d+__/.test(protectedText)) {
    return [chunk];
  }

  const midpoint = Math.floor(protectedText.length / 2);
  const forward = protectedText.indexOf(' ', midpoint);
  const backward = protectedText.lastIndexOf(' ', midpoint);
  const cut = backward > 0 ? backward : (forward > 0 ? forward : midpoint);
  const left = protectedText.slice(0, cut).trim();
  const right = protectedText.slice(cut).trim();
  if (!left || !right) return [chunk];
  return [
    restorePlaceholders(left, placeholders).trim(),
    restorePlaceholders(right, placeholders).trim()
  ].filter(Boolean);
}

function ensureMinimumChunkCount(chunks, minChunks) {
  if (!Array.isArray(chunks) || chunks.length >= minChunks) return chunks;

  const expanded = [...chunks];
  let guard = 0;
  const maxIterations = Math.max(12, minChunks * 8);

  while (expanded.length < minChunks && guard < maxIterations) {
    guard += 1;
    let largestIndex = -1;
    let largestLen = 0;

    for (let i = 0; i < expanded.length; i += 1) {
      const len = typeof expanded[i] === 'string' ? expanded[i].length : 0;
      if (len > largestLen) {
        largestLen = len;
        largestIndex = i;
      }
    }

    if (largestIndex < 0 || largestLen < 2) break;

    const pieces = splitChunkForMinimum(expanded[largestIndex]);
    if (!Array.isArray(pieces) || pieces.length < 2) break;

    expanded.splice(largestIndex, 1, ...pieces);
  }

  return expanded;
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

function mergeChunksForReadability(chunks, maxChunks, minChunks = 1) {
  if (!Array.isArray(chunks) || chunks.length <= 1) return chunks;

  const merged = [...chunks];

  const mergePair = (index) => {
    const combined = `${merged[index]}\n\n${merged[index + 1]}`.trim();
    merged.splice(index, 2, combined);
  };

  let changed = true;
  while (changed && merged.length > minChunks) {
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

  if (merged.length > minChunks && merged.length > 1) {
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

  if (finalized.length < minChunks) {
    finalized = enforceHardLimit(forceMinimumChunks(text, minChunks));
  }

  finalized = ensureMinimumChunkCount(finalized, minChunks);
  finalized = mergeChunksForReadability(finalized, maxChunks, minChunks);

  if (finalized.length <= 1) return finalized;
  if (!addPageHeader) return finalized;

  return finalized.map((chunk, index) => {
    const page = `**\u{1F4D8} CyberCortex Response (${index + 1}/${finalized.length})**`;
    return `${page}\n\n${chunk}`;
  });
}

module.exports = {
  smartSplitMessage
};
