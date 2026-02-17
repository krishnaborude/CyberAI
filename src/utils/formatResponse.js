const CODE_BLOCK_REGEX = /```[\s\S]*?```/g;

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

function parseMarkdownTableRow(line) {
  if (typeof line !== 'string' || !line.includes('|')) return null;
  const trimmed = line.trim();
  if (!trimmed) return null;

  const hasOuterPipes = trimmed.startsWith('|') || trimmed.endsWith('|');
  let cells = trimmed.split('|').map((part) => part.trim());

  if (hasOuterPipes && cells[0] === '') cells = cells.slice(1);
  if (hasOuterPipes && cells[cells.length - 1] === '') cells = cells.slice(0, -1);
  if (cells.length < 2) return null;

  return cells;
}

function isMarkdownTableSeparator(line) {
  const cells = parseMarkdownTableRow(line);
  if (!cells) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function formatTableAsDiscordList(headers, rows) {
  const cleanedHeaders = headers.map((header, index) => header || `Column ${index + 1}`);
  const primaryHeader = cleanedHeaders[0] || 'Item';

  return rows.map((row, rowIndex) => {
    const primaryValue = row[0] || `Row ${rowIndex + 1}`;
    const lines = [`- **${primaryHeader}:** ${primaryValue}`];

    for (let i = 1; i < cleanedHeaders.length; i += 1) {
      const value = row[i];
      if (!value) continue;
      lines.push(`  **${cleanedHeaders[i]}:** ${value}`);
    }

    return lines.join('\n');
  }).join('\n\n');
}

function convertMarkdownTablesToDiscordLists(input) {
  if (typeof input !== 'string' || !input.includes('|')) return input;

  const lines = input.split('\n');
  const output = [];

  for (let i = 0; i < lines.length; i += 1) {
    const headerCells = parseMarkdownTableRow(lines[i]);
    const separatorLine = lines[i + 1];

    if (!headerCells || !isMarkdownTableSeparator(separatorLine)) {
      output.push(lines[i]);
      continue;
    }

    const rows = [];
    let cursor = i + 2;
    while (cursor < lines.length) {
      const rowCells = parseMarkdownTableRow(lines[cursor]);
      if (!rowCells) break;
      rows.push(rowCells);
      cursor += 1;
    }

    if (rows.length === 0) {
      output.push(lines[i]);
      output.push(lines[i + 1]);
      i += 1;
      continue;
    }

    output.push(formatTableAsDiscordList(headerCells, rows));
    i = cursor - 1;
  }

  return output.join('\n');
}

function extractCopyableSnippet(line) {
  if (typeof line !== 'string') return '';
  if (/__CODE_BLOCK_\d+__/.test(line)) return '';

  const inlineCode = line.match(/`([^`\n]+)`/);
  if (inlineCode && inlineCode[1]) {
    return inlineCode[1].trim();
  }

  const trimmed = line.trim();
  if (!trimmed) return '';

  if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|ALTER|CREATE|DROP)\b/i.test(trimmed)) {
    return trimmed;
  }

  // Common short payload patterns often shown inline in educational examples.
  if (/['"`]\s*(?:or|and)\s+['"`0-9a-z_]/i.test(trimmed) && /=/.test(trimmed)) {
    return trimmed;
  }

  return '';
}

function injectCopyableCodeBlocks(input) {
  if (typeof input !== 'string' || !input.trim()) return input;

  const labelRegex = /^\s*(?:#{1,6}\s*)?(?:[-*]\s+)?\*{0,2}(Vulnerable Code Example(?:\s*\(Conceptual\))?|Attack Payload|Resulting Executable Query|Executable Query|Payload|Query)\*{0,2}\s*:\s*$/i;
  const lines = input.split('\n');
  const output = [];
  let awaitingSnippet = false;
  let inspectedNonEmpty = 0;
  const maxNonEmptyLookahead = 4;

  for (const line of lines) {
    output.push(line);

    if (labelRegex.test(line)) {
      awaitingSnippet = true;
      inspectedNonEmpty = 0;
      continue;
    }

    if (!awaitingSnippet) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s+/.test(trimmed)) {
      awaitingSnippet = false;
      continue;
    }

    inspectedNonEmpty += 1;
    const snippet = extractCopyableSnippet(line);
    if (snippet) {
      const isWholeLineSnippet = snippet === trimmed;
      if (isWholeLineSnippet) {
        output.pop();
      }
      output.push('', '```text', snippet, '```');
      awaitingSnippet = false;
      continue;
    }

    if (inspectedNonEmpty >= maxNonEmptyLookahead) {
      awaitingSnippet = false;
    }
  }

  return output.join('\n');
}

function trimVerboseRefusalPreface(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return raw;

  const prefacePattern = /^(?:I\s+(?:cannot|can't)\s+provide[^.]*\.\s*)+(?:My\s+purpose\s+is[^.]*\.\s*)?/i;
  if (!prefacePattern.test(raw)) return raw;

  const trimmed = raw.replace(prefacePattern, '').trim();
  if (!trimmed) return raw;

  // Only keep the trim when useful topic content remains.
  if (!/(overview|defensive|detection|prevention|mitigation|safe|lab|practice|how it works|what it is)/i.test(trimmed)) {
    return raw;
  }

  return trimmed.replace(/^I\s+can,\s+however,\s*/i, '').trim();
}

function formatGenericMarkdown(input) {
  const raw = typeof input === 'string' ? input : '';
  if (!raw.trim()) return raw;

  const { protectedText, placeholders } = protectCodeBlocks(raw.replace(/\r\n/g, '\n'));
  let text = trimVerboseRefusalPreface(protectedText.trim());

  // Drop leading "Disclaimer:" blocks (they're repetitive in Discord). Keep safety by other means.
  // Handles:
  // - "Disclaimer: ...\n...\n"
  // - "## Disclaimer\n...\n"
  // - A title line followed by a disclaimer line.
  const lines = text.split('\n');
  const nonEmptyIdx = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim()) nonEmptyIdx.push(i);
    if (nonEmptyIdx.length >= 3) break;
  }

  const isDisclaimerLine = (line) => {
    const l = String(line || '').trim();
    return (
      /^#{1,6}\s*disclaimer\b/i.test(l)
      || /^-?\s*\*{0,2}disclaimer\*{0,2}\s*:/i.test(l)
      || /^-?\s*disclaimer\s*:/i.test(l)
    );
  };

  const removeDisclaimerBlockStartingAt = (startIdx) => {
    let i = startIdx;
    // Remove until the next blank line (or EOF).
    while (i < lines.length && lines[i].trim()) i += 1;
    // Remove trailing blank lines too.
    while (i < lines.length && !lines[i].trim()) i += 1;
    lines.splice(startIdx, i - startIdx);
  };

  if (nonEmptyIdx.length > 0 && isDisclaimerLine(lines[nonEmptyIdx[0]])) {
    removeDisclaimerBlockStartingAt(nonEmptyIdx[0]);
    text = lines.join('\n').trim();
  } else if (nonEmptyIdx.length > 1 && isDisclaimerLine(lines[nonEmptyIdx[1]])) {
    removeDisclaimerBlockStartingAt(nonEmptyIdx[1]);
    text = lines.join('\n').trim();
  }

  // Discord does not render markdown pipe tables well; convert them to readable list blocks.
  text = convertMarkdownTablesToDiscordLists(text);

  // Make payload/query snippets copyable by adding fenced code blocks after labeled lines.
  text = injectCopyableCodeBlocks(text);

  // Convert "inline bullets" like "... safe. *   Item: ..." into real list lines.
  text = text.replace(/([^\n])\s*\*\s{2,}(?=[A-Z0-9])/g, '$1\n- ');

  // Normalize common bullet markers at line start.
  text = text.replace(/(^|\n)\s*\*\s+(?=\S)/g, '$1- ');
  text = text.replace(/(^|\n)\s*•\s+(?=\S)/g, '$1- ');

  // Ensure a blank line before headings.
  text = text.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');

  // Collapse excessive blank lines.
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return restorePlaceholders(text, placeholders);
}

function formatRoadmapMarkdown(input) {
  const raw = typeof input === 'string' ? input : '';
  if (!raw.trim()) return raw;

  const { protectedText, placeholders } = protectCodeBlocks(raw.replace(/\r\n/g, '\n'));
  let text = protectedText.trim();

  // Convert "inline bullets" like "... fundamentals. *   Week 1: ..." into real lines.
  text = text.replace(/([^\n])\s*\*\s{2,}(?=[A-Z])/g, '$1\n- ');

  // Normalize bullet markers at line start.
  text = text.replace(/(^|\n)\s*\*\s+(?=\S)/g, '$1- ');

  // Promote Phase lines to headings if they aren't already headings.
  text = text.replace(/(^|\n)\s*(?!#{1,6}\s)(Phase\s+\d+\s*:[^\n]+)/gmi, '$1## $2');

  // Promote Week lines to headings for easier scanning and better chunk splitting.
  text = text.replace(/(^|\n)\s*(?!#{1,6}\s)(?:[-*]\s+)?(Week\s+\d+\s*:[^\n]+)/gmi, '$1### $2');

  // Promote Goal lines to headings (common pattern in roadmap output).
  text = text.replace(/(^|\n)\s*(?!#{1,6}\s)(Goal\s*:\s*[^\n]+)/gmi, '$1### $2');

  // Make common labels consistent and readable.
  text = text.replace(/(^|\n)\s*(Concept|Explanation|Topics|Tools|Action|Deliverable|Practice|Example)\s*:\s*/gmi, '$1- **$2:** ');

  // Ensure blank line before major headings for readability.
  text = text.replace(/([^\n])\n(##\s+)/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n(###\s+)/g, '$1\n\n$2');

  // Collapse excessive blank lines.
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return restorePlaceholders(text, placeholders);
}

function formatRedteamMarkdown(input) {
  const raw = typeof input === 'string' ? input : '';
  if (!raw.trim()) return raw;

  const { protectedText, placeholders } = protectCodeBlocks(raw.replace(/\r\n/g, '\n'));
  let text = protectedText.trim();

  // Convert "inline bullets" like "... environment. *   Burp Suite: ..." into real lines.
  text = text.replace(/([^\n])\s*\*\s{2,}(?=[A-Z])/g, '$1\n- ');

  // Normalize bullet markers at line start.
  text = text.replace(/(^|\n)\s*\*\s+(?=\S)/g, '$1- ');

  // Promote common red-team section titles to headings if they aren't already.
  const sectionTitles = [
    'Authorization and Scope Assumptions',
    'Threat Model and Objective Mapping',
    'Attack Chain Simulation (High-Level, Lab-Safe)',
    'Safe Commands and Tooling for Authorized Environments',
    'Detection Opportunities Mapped to Each Phase',
    'Defensive Mitigations and Hardening Actions',
    'Debrief Checklist and Reporting Template'
  ];
  for (const title of sectionTitles) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|\\n)\\s*(?!#{1,6}\\s)${escaped}\\s*\\n`, 'g');
    text = text.replace(re, `$1## ${title}\n`);
  }

  // Normalize common labels.
  text = text.replace(/(^|\n)\s*(Authorization|Scope|Legal Compliance)\s*:\s*/gmi, '$1- **$2:** ');
  text = text.replace(/(^|\n)\s*(Objective|Goal|Constraints?)\s*:\s*/gmi, '$1- **$2:** ');
  text = text.replace(/(^|\n)\s*(Tools|Installation|Usage|Example|Detection|Mitigation|Notes?)\s*:\s*/gmi, '$1- **$2:** ');

  // Ensure blank line before major headings for readability.
  text = text.replace(/([^\n])\n(##\s+)/g, '$1\n\n$2');

  // Collapse excessive blank lines.
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return restorePlaceholders(text, placeholders);
}

function formatResponseByCommand(command, text) {
  const base = formatGenericMarkdown(text);
  if (command === 'roadmap') return formatRoadmapMarkdown(base);
  if (command === 'redteam') return formatRedteamMarkdown(base);
  return base;
}

module.exports = {
  formatResponseByCommand
};
