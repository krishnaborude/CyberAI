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

function formatResponseByCommand(command, text) {
  if (command === 'roadmap') return formatRoadmapMarkdown(text);
  return text;
}

module.exports = {
  formatResponseByCommand
};

