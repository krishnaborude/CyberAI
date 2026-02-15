const { URL } = require('node:url');

class NewsService {
  constructor({ logger, gemini = null }) {
    this.logger = logger;
    this.gemini = gemini;
    this.cisaIcsIndexUrl = 'https://www.cisa.gov/news-events/ics-advisories';
    this.feeds = [
      { source: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews' },
      { source: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
      { source: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
      { source: 'CISA Alerts', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml' }
    ];
  }

  formatUpdatedAtIst(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Unknown time';
    // India Standard Time is fixed at UTC+05:30 (no DST).
    const ist = new Date(date.getTime() + 330 * 60 * 1000);
    return `${ist.toISOString().replace('T', ' ').slice(0, 16)} IST`;
  }

  decodeEntities(value) {
    const input = typeof value === 'string' ? value : '';
    return input
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#x2F;/gi, '/')
      .replace(/&#160;/g, ' ')
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
    const description = this.readTag(block, 'description')
      || this.readTag(block, 'summary')
      || this.readTag(block, 'content:encoded');

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

  extractHtmlMetaContent(html, key) {
    const safeKey = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${safeKey}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${safeKey}["'][^>]*>`, 'i')
    ];

    for (const re of patterns) {
      const match = String(html || '').match(re);
      if (match && match[1]) return this.cleanText(match[1]);
    }
    return '';
  }

  extractHtmlTitle(html) {
    const og = this.extractHtmlMetaContent(html, 'og:title');
    if (og) return og;

    const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (match && match[1]) return this.cleanText(match[1]);
    return '';
  }

  extractHtmlPublishedAt(html) {
    const meta = this.extractHtmlMetaContent(html, 'article:published_time');
    const viaMeta = this.parsePubDate(meta);
    if (viaMeta) return viaMeta;

    const dt = String(html || '').match(/datetime=["']([^"']+)["']/i);
    const viaDatetime = this.parsePubDate(dt ? dt[1] : '');
    if (viaDatetime) return viaDatetime;

    const iso = String(html || '').match(/\b(20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\b/);
    const viaIso = this.parsePubDate(iso ? iso[1] : '');
    if (viaIso) return viaIso;

    return null;
  }

  async fetchCisaIcsAdvisories({ limit = 10 } = {}) {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 5), 20);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch(this.cisaIcsIndexUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CyberAI-DiscordBot/1.0' }
      });
      if (!response.ok) throw new Error(`ICS index request failed (${response.status})`);

      const html = await response.text();
      const paths = Array.from(
        new Set(
          (html.match(/\/news-events\/ics-advisories\/icsa-\d{2}-\d{3}-\d{2}/gi) || [])
            .map((v) => v.trim())
            .filter(Boolean)
        )
      ).slice(0, safeLimit);

      const urls = paths
        .map((p) => this.toSafeUrl(`https://www.cisa.gov${p}`, this.cisaIcsIndexUrl))
        .filter(Boolean);

      const settled = await Promise.allSettled(urls.map(async (url) => {
        const pageController = new AbortController();
        const pageTimeout = setTimeout(() => pageController.abort(), 9000);

        try {
          const pageResp = await fetch(url, {
            signal: pageController.signal,
            headers: { 'User-Agent': 'CyberAI-DiscordBot/1.0' }
          });
          if (!pageResp.ok) throw new Error(`ICS advisory request failed (${pageResp.status})`);

          const pageHtml = await pageResp.text();
          const title = this.extractHtmlTitle(pageHtml);
          const description = this.extractHtmlMetaContent(pageHtml, 'description')
            || this.extractHtmlMetaContent(pageHtml, 'og:description');
          const publishedAt = this.extractHtmlPublishedAt(pageHtml);

          return {
            title: title || url,
            link: url,
            source: 'CISA ICS Advisories',
            description,
            publishedAt
          };
        } finally {
          clearTimeout(pageTimeout);
        }
      }));

      const items = [];
      for (const entry of settled) {
        if (entry.status === 'fulfilled' && entry.value?.title && entry.value?.link) {
          items.push(entry.value);
        }
      }
      return items;
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

  buildFocusKeywords(focus) {
    const raw = typeof focus === 'string' ? focus.toLowerCase() : '';
    const base = raw
      .split(/[^a-z0-9]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3 && !['news', 'cyber', 'security', 'general', 'latest', 'all'].includes(word));

    const extra = [];
    const joined = raw.replace(/\s+/g, ' ').trim();
    if (joined.includes('zero') || joined.includes('0day') || joined.includes('0-day')) {
      extra.push('zero-day', 'zero day', '0day', '0-day');
      extra.push('actively exploited', 'exploited', 'in the wild');
      extra.push('kev', 'known exploited vulnerabilities', 'cve');
    }

    const out = [];
    const seen = new Set();
    for (const word of [...base, ...extra]) {
      if (!word || seen.has(word)) continue;
      seen.add(word);
      out.push(word);
    }
    return out;
  }

  async getLatestNews({ focus = '', limit = 7 } = {}) {
    const settled = await Promise.allSettled([
      ...this.feeds.map((feed) => this.fetchFeed(feed)),
      this.fetchCisaIcsAdvisories({ limit: 8 })
    ]);

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

    const keywords = this.buildFocusKeywords(focus);

    const ranked = unique
      .map((item) => ({ item, score: this.keywordMatchScore(item, keywords) }))
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
      articles: ranked.length > 0 ? ranked : fallback,
      keywords
    };
  }

  formatDate(date) {
    if (!date) return 'Unknown date';
    return date.toISOString().slice(0, 10);
  }

  clip(text, maxLen) {
    if (!text) return '';
    const normalized = String(text).replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen - 3)}...`;
  }

  classifyTierHeuristic(item, focusKeywords = []) {
    const text = `${item.title} ${item.description} ${item.source}`.toLowerCase();

    const hasZeroDay = /(?:\b0-?day\b|\bzero[-\s]?day\b)/i.test(text);
    const hasExploitation = /(?:actively exploited|exploited in the wild|in the wild|under attack|actively being exploited)/i.test(text);
    const hasKevLanguage = /(?:\bkev\b|known exploited vulnerabilities|known exploited vulnerability|cisa adds \d+ known exploited|added (?:one|two|three|four|five|six|seven|eight|nine|\d+) known exploited)/i.test(text);
    const hasRce = /\brce\b|remote code execution/i.test(text);
    const patchy = /patch tuesday|patch(?:es|ing)?|fix(?:es|ed)?|security update|released update|advisory|vulnerabilit/i.test(text);

    if (hasKevLanguage || hasExploitation || (hasZeroDay && hasExploitation) || (hasRce && hasExploitation)) {
      return { tier: 'Critical', reason: 'Active exploitation / zero-day signal' };
    }

    if (hasZeroDay || patchy) {
      return { tier: 'Intermediate', reason: hasZeroDay ? 'Zero-day mentioned' : 'Patch/advisory content' };
    }

    const focusImpliesZeroDay = focusKeywords.some((k) => k.includes('zero') || k.includes('0day') || k.includes('0-day'));
    if (focusImpliesZeroDay && !hasZeroDay) {
      return { tier: 'Basic', reason: 'General news (not zero-day)' };
    }

    return { tier: 'Basic', reason: 'General news' };
  }

  async selectAndEnrich({ focus, fetchedAt, articles, keywords, limit = 7, tier = 'all' } = {}) {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 7, 5), 12);
    const list = Array.isArray(articles) ? articles : [];
    const tierFilter = typeof tier === 'string' ? tier.trim().toLowerCase() : 'all';

    const pool = list
      .slice()
      .sort((a, b) => {
        const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
        const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 28);

    if (!this.gemini?.rankNewsFromFeed) {
      const enrichedAll = pool.map((item) => {
        const tier = this.classifyTierHeuristic(item, keywords || []);
        return { ...item, ...tier, summary: item.description };
      });
      const filtered = tierFilter === 'critical'
        ? enrichedAll.filter((a) => a.tier === 'Critical')
        : tierFilter === 'intermediate'
          ? enrichedAll.filter((a) => a.tier === 'Intermediate')
          : tierFilter === 'basic'
            ? enrichedAll.filter((a) => a.tier === 'Basic')
            : enrichedAll;

      return {
        focus,
        fetchedAt,
        articles: filtered.slice(0, safeLimit),
        keywords,
        selectionMeta: { strategy: 'heuristic', tierFilter }
      };
    }

    try {
      const gem = await this.gemini.rankNewsFromFeed({
        focus,
        articles: pool,
        limit: safeLimit,
        tier: tierFilter
      });

      const byLink = new Map();
      for (const item of pool) byLink.set(item.link, item);

      const picked = [];
      for (const selected of gem?.selected || []) {
        const base = byLink.get(selected.link);
        if (!base) continue;
        picked.push({
          ...base,
          tier: selected.tier,
          reason: selected.reason,
          summary: selected.summary || base.description
        });
      }

      let finalList = picked.length > 0 ? picked : pool.slice(0, safeLimit).map((item) => {
        const tier = this.classifyTierHeuristic(item, keywords || []);
        return { ...item, ...tier, summary: item.description };
      });

      // For tier-filter requests, if Gemini didn't return enough items, fill from heuristic-tiered pool.
      if (tierFilter !== 'all') {
        const want = tierFilter === 'critical' ? 'Critical' : tierFilter === 'intermediate' ? 'Intermediate' : 'Basic';
        const haveLinks = new Set(finalList.map((a) => a.link).filter(Boolean));
        const heuristic = pool
          .map((item) => ({ item, h: this.classifyTierHeuristic(item, keywords || []) }))
          .filter((entry) => entry.h.tier === want)
          .map((entry) => ({ ...entry.item, ...entry.h, summary: entry.item.description }));

        for (const item of heuristic) {
          if (finalList.length >= safeLimit) break;
          if (haveLinks.has(item.link)) continue;
          finalList.push(item);
          haveLinks.add(item.link);
        }

        finalList = finalList.filter((a) => a.tier === want).slice(0, safeLimit);
      }

      // If Gemini returns a single-tier list (common for "zero-days"), rebalance using heuristics
      // so Intermediate/Basic sections don't end up empty when the pool clearly contains them.
      if (picked.length > 0 && tierFilter === 'all') {
        const counts = { Critical: 0, Intermediate: 0, Basic: 0 };
        for (const item of finalList) {
          const t = item?.tier === 'Critical' || item?.tier === 'Intermediate' || item?.tier === 'Basic'
            ? item.tier
            : 'Intermediate';
          counts[t] += 1;
        }

        const nonZero = Object.values(counts).filter((v) => v > 0).length;
        if (nonZero <= 1) {
          finalList = finalList.map((item) => {
            const h = this.classifyTierHeuristic(item, keywords || []);
            // Only downgrade (never upgrade) so we keep real "Critical" signals.
            const order = { Critical: 3, Intermediate: 2, Basic: 1 };
            const current = item?.tier || 'Intermediate';
            const next = order[h.tier] < order[current] ? h.tier : current;
            const reason = item?.reason ? item.reason : h.reason;
            return { ...item, tier: next, reason };
          });
        }
      }

      return {
        focus,
        fetchedAt,
        articles: finalList,
        keywords,
        selectionMeta: {
          strategy: picked.length > 0 ? 'gemini' : 'heuristic',
          expandedKeywords: Array.isArray(gem?.expanded_keywords) ? gem.expanded_keywords : [],
          tierFilter
        }
      };
    } catch (error) {
      this.logger.warn('Gemini news selection failed, falling back to heuristic', { error: error?.message || String(error) });
      const enrichedAll = pool.map((item) => {
        const tier = this.classifyTierHeuristic(item, keywords || []);
        return { ...item, ...tier, summary: item.description };
      });

      const filtered = tierFilter === 'critical'
        ? enrichedAll.filter((a) => a.tier === 'Critical')
        : tierFilter === 'intermediate'
          ? enrichedAll.filter((a) => a.tier === 'Intermediate')
          : tierFilter === 'basic'
            ? enrichedAll.filter((a) => a.tier === 'Basic')
            : enrichedAll;

      return {
        focus,
        fetchedAt,
        articles: filtered.slice(0, safeLimit),
        keywords,
        selectionMeta: { strategy: 'heuristic', tierFilter }
      };
    }
  }

  formatDigest({ focus, fetchedAt, articles, keywords, selectionMeta }) {
    const list = Array.isArray(articles) ? articles : [];
    const viewTier = typeof selectionMeta?.tierFilter === 'string' ? selectionMeta.tierFilter : 'all';

    const scope = focus ? `Focus: ${focus}` : 'Focus: general';
    const header = [
      '## Cybersecurity News (Live Links)',
      `Focus: ${focus || 'general'}`,
      selectionMeta?.tierFilter && selectionMeta.tierFilter !== 'all'
        ? `Tier: ${selectionMeta.tierFilter}`
        : null,
      `Updated: ${this.formatUpdatedAtIst(fetchedAt)}`,
      '',
      '### Read Full Articles'
    ].filter(Boolean).join('\n');

    if (list.length === 0) {
      if (viewTier !== 'all') {
        return `${header}\n\nNo ${viewTier} stories matched right now. Try \`/news tier: all\` or add \`focus: zero-days\`.`;
      }
      return '## Cybersecurity News\n\nNo live articles were available right now. Please try again in a few minutes.';
    }

    const safeTier = (tier) => (tier === 'Critical' || tier === 'Intermediate' || tier === 'Basic' ? tier : 'Intermediate');

    const sortedByTime = [...list].sort((a, b) => {
      const aTime = a.publishedAt ? a.publishedAt.getTime() : 0;
      const bTime = b.publishedAt ? b.publishedAt.getTime() : 0;
      return bTime - aTime;
    });

    const latest = sortedByTime.slice(0, Math.min(3, sortedByTime.length));
    const latestLinks = new Set(latest.map((a) => a.link).filter(Boolean));

    const buckets = {
      Critical: [],
      Intermediate: [],
      Basic: []
    };

    for (const article of list) {
      if (latestLinks.has(article.link)) continue;
      const tier = safeTier(article.tier);
      buckets[tier].push(article);
    }

    const renderList = (list) => {
      if (!list || list.length === 0) return ['- (none)'];

      const lines = [];
      for (let i = 0; i < list.length; i += 1) {
        const article = list[i];
        const dateText = this.formatDate(article.publishedAt);
        const summary = this.clip(article.summary || article.description, 160);
        const summaryLine = summary ? `\n   - Summary: ${summary}` : '';
        const reasonLine = article.reason ? `\n   - Why: ${this.clip(article.reason, 70)}` : '';
        const tierLine = article.tier ? ` | Tier: ${safeTier(article.tier)}` : '';

        lines.push([
          `${i + 1}. **${article.title}**`,
          `   - Source: ${article.source} | Date: ${dateText}${tierLine}`,
          `   - Link: <${article.link}>${summaryLine}${reasonLine}`
        ].join('\n'));
      }
      return lines;
    };

    const sections = [];
    if (viewTier === 'critical') {
      sections.push('### Critical');
      sections.push(...renderList(list));
      return `${header}\n\n${sections.join('\n\n')}`;
    }
    if (viewTier === 'intermediate') {
      sections.push('### Intermediate');
      sections.push(...renderList(list));
      return `${header}\n\n${sections.join('\n\n')}`;
    }
    if (viewTier === 'basic') {
      sections.push('### Basic');
      sections.push(...renderList(list));
      return `${header}\n\n${sections.join('\n\n')}`;
    }

    sections.push('### Latest');
    sections.push(...renderList(latest));
    if (buckets.Critical.length > 0) {
      sections.push('### Critical');
      sections.push(...renderList(buckets.Critical));
    }
    if (buckets.Intermediate.length > 0) {
      sections.push('### Intermediate');
      sections.push(...renderList(buckets.Intermediate));
    }
    if (buckets.Basic.length > 0) {
      sections.push('### Basic');
      sections.push(...renderList(buckets.Basic));
    }

    return `${header}\n\n${sections.join('\n\n')}`;
  }
}

module.exports = NewsService;
