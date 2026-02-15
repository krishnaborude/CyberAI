class NewsService {
  constructor({ logger }) {
    this.logger = logger;
    this.feeds = [
      { source: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
      { source: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
      { source: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
      { source: 'CISA Alerts', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' }
    ];
  }

  decodeEntities(value) {
    const input = typeof value === 'string' ? value : '';
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x2F;/gi, '/')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)));
  }

  cleanText(value) {
    if (typeof value !== 'string') return '';

    let text = value;
    for (let i = 0; i < 3; i += 1) {
      text = this.decodeEntities(text)
        .replace(/^<!\[CDATA\[/i, '')
        .replace(/\]\]>$/i, '')
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ');
    }

    return text
      .replace(/\s+/g, ' ')
      .replace(/^View\s+CSAF\s+/i, '')
      .replace(/^Read\s+more\s*:?\s*/i, '')
      .trim();
  }

  readTag(block, tagName) {
    const safeTag = tagName.replace(':', '\\:');
    const regex = new RegExp(`<${safeTag}[^>]*>([\\s\\S]*?)<\\/${safeTag}>`, 'i');
    const match = block.match(regex);
    if (!match) return '';

    return match[1].trim();
  }

  readTagAttribute(block, tagName, attribute) {
    const safeTag = tagName.replace(':', '\\:');
    const regex = new RegExp(`<${safeTag}[^>]*\\b${attribute}=["']([^"']+)["'][^>]*\\/?>(?:<\\/${safeTag}>)?`, 'i');
    const match = block.match(regex);
    return match ? match[1].trim() : '';
  }

  parsePubDate(raw) {
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  toSafeUrl(rawUrl, baseUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';

    try {
      const url = new URL(rawUrl.trim(), baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.toString();
    } catch {
      return '';
    }
  }

  extractFirstHref(value, baseUrl) {
    if (typeof value !== 'string' || !value) return '';

    const decoded = this.decodeEntities(value);
    const hrefMatch = decoded.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefMatch) {
      const safe = this.toSafeUrl(hrefMatch[1], baseUrl);
      if (safe) return safe;
    }

    const directMatch = decoded.match(/https?:\/\/[^\s"'<>\]]+/i);
    if (directMatch) {
      const safe = this.toSafeUrl(directMatch[0], baseUrl);
      if (safe) return safe;
    }

    return '';
  }

  extractLink(block, baseUrl) {
    const description = this.readTag(block, 'description') || this.readTag(block, 'summary') || this.readTag(block, 'content:encoded');

    const candidates = [
      this.readTag(block, 'link'),
      this.readTagAttribute(block, 'link', 'href'),
      this.readTag(block, 'guid'),
      this.readTag(block, 'id'),
      this.extractFirstHref(description, baseUrl)
    ];

    for (const candidate of candidates) {
      const safe = this.toSafeUrl(this.cleanText(candidate), baseUrl);
      if (safe) return safe;
    }

    return '';
  }

  parseItems(xml, feed) {
    const blocks = [
      ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) || []),
      ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [])
    ];

    return blocks.map((block) => {
      const rawTitle = this.readTag(block, 'title') || this.readTag(block, 'dc:title');
      const title = this.cleanText(rawTitle);

      const rawDescription = this.readTag(block, 'description')
        || this.readTag(block, 'summary')
        || this.readTag(block, 'content:encoded');
      let description = this.cleanText(rawDescription);
      if (description.toLowerCase() === title.toLowerCase()) {
        description = '';
      }

      const link = this.extractLink(block, feed.url);

      const pubDateRaw = this.readTag(block, 'pubDate')
        || this.readTag(block, 'updated')
        || this.readTag(block, 'published')
        || this.readTag(block, 'dc:date');
      const publishedAt = this.parsePubDate(this.cleanText(pubDateRaw));

      return {
        title,
        link,
        source: feed.source,
        description,
        publishedAt
      };
    }).filter((item) => item.title && item.link);
  }

  async fetchFeed(feed) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(feed.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CyberAI-DiscordBot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Feed request failed with status ${response.status}`);
      }

      const xml = await response.text();
      return this.parseItems(xml, feed);
    } finally {
      clearTimeout(timeout);
    }
  }

  keywordMatchScore(item, keywords) {
    if (keywords.length === 0) return 1;

    const text = `${item.title} ${item.description} ${item.source}`.toLowerCase();
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score += 1;
    }

    return score;
  }

  async getLatestNews({ focus = '', limit = 7 } = {}) {
    const settled = await Promise.allSettled(this.feeds.map((feed) => this.fetchFeed(feed)));

    const allItems = [];
    for (const entry of settled) {
      if (entry.status === 'fulfilled') {
        allItems.push(...entry.value.slice(0, 20));
      } else {
        this.logger.warn('Failed to fetch one news feed', { error: entry.reason?.message || String(entry.reason) });
      }
    }

    const unique = [];
    const seen = new Set();
    for (const item of allItems) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      unique.push(item);
    }

    const keywords = focus
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3 && !['news', 'cyber', 'security', 'general', 'latest', 'all'].includes(word));

    const ranked = unique
      .map((item) => ({ item, score: this.keywordMatchScore(item, keywords) }))
      .filter((entry) => keywords.length === 0 || entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aTime = a.item.publishedAt ? a.item.publishedAt.getTime() : 0;
        const bTime = b.item.publishedAt ? b.item.publishedAt.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit)
      .map((entry) => entry.item);

    const fallback = unique
      .sort((a, b) => {
        const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
        const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    return {
      focus,
      fetchedAt: new Date(),
      articles: ranked.length > 0 ? ranked : fallback
    };
  }

  formatDate(date) {
    if (!date) return 'Unknown date';
    return date.toISOString().slice(0, 10);
  }

  clip(text, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen - 3)}...`;
  }

  formatDigest({ focus, fetchedAt, articles }) {
    if (!articles || articles.length === 0) {
      return '## Cybersecurity News\n\nNo live articles were available right now. Please try again in a few minutes.';
    }

    const scope = focus ? `Focus: ${focus}` : 'Focus: general';
    const header = [
      '## Cybersecurity News (Live Links)',
      `- ${scope}`,
      `- Updated: ${fetchedAt.toISOString().replace('T', ' ').slice(0, 16)} UTC`,
      '',
      '### Read Full Articles'
    ].join('\n');

    const lines = articles.map((article, index) => {
      const description = this.clip(article.description, 220) || 'No description available from the feed.';

      return [
        `${index + 1}. **${article.title}**`,
        `   - Link: <${article.link}>`,
        `   - Description: ${description}`
      ].join('\n');
    });

    return `${header}\n\n${lines.join('\n\n')}`;
  }
}

module.exports = NewsService;
