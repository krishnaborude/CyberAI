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

function formatGenericMarkdown(input) {
  const raw = typeof input === 'string' ? input : '';
  if (!raw.trim()) return raw;

  const { protectedText, placeholders } = protectCodeBlocks(raw.replace(/\r\n/g, '\n'));
  let text = protectedText.trim();

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
