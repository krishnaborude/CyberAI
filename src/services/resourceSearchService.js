const { URL } = require('node:url');

class ResourceSearchService {
  constructor({ apiKey, apiKeys, logger }) {
    const keys = Array.isArray(apiKeys) ? apiKeys : [];
    const legacy = apiKey ? [apiKey] : [];
    this.apiKeys = [...legacy, ...keys].map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
    this.logger = logger;
  }

  hasApiKey() {
    return this.apiKeys.length > 0;
  }

  normalizeType(type) {
    const value = typeof type === 'string' ? type.trim().toLowerCase() : 'all';
    if (value === 'github') return 'github';
    if (value === 'books') return 'books';
    if (value === 'blogs') return 'blogs';
    if (value === 'walkthrough') return 'walkthrough';
    if (value === 'articles') return 'articles';
    return 'all';
  }

  buildQueries(query, type = 'all') {
    const safeType = this.normalizeType(type);
    const q = typeof query === 'string' ? query.trim() : '';
    const base = q || 'cybersecurity';

    if (safeType === 'github') {
      return [
        `${base} cybersecurity tool site:github.com -site:github.com/topics -site:github.com/search -site:github.com/trending`,
        `${base} security lab site:github.com -site:github.com/topics -site:github.com/search -site:github.com/trending`
      ];
    }

    if (safeType === 'books') {
      return [
        `${base} cybersecurity book`,
        `${base} security handbook OR ebook`
      ];
    }

    if (safeType === 'blogs') {
      return [
        `${base} cybersecurity blog`,
        `${base} security writeup blog`
      ];
    }

    if (safeType === 'walkthrough') {
      return [
        `${base} cybersecurity walkthrough`,
        `${base} CTF writeup`
      ];
    }

    if (safeType === 'articles') {
      return [
        `${base} cybersecurity article`,
        `${base} security analysis`
      ];
    }

    return [
      `${base} cybersecurity article`,
      `${base} cybersecurity blog`,
      `${base} cybersecurity github repository`,
      `${base} cybersecurity book`,
      `${base} cybersecurity walkthrough`
    ];
  }

  isValidUrl(raw) {
    if (!raw || typeof raw !== 'string') return false;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }

  isUsefulGitHubRepoUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const host = url.hostname.toLowerCase();
      if (!host.includes('github.com')) return true;

      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return false;

      const owner = (parts[0] || '').toLowerCase();
      const repo = (parts[1] || '').toLowerCase();
      if (!owner || !repo) return false;

      const blockedOwnerLike = new Set([
        'topics',
        'search',
        'collections',
        'trending',
        'events',
        'marketplace',
        'sponsors',
        'features',
        'orgs',
        'organizations',
        'users',
        'explore',
        'site'
      ]);
      if (blockedOwnerLike.has(owner)) return false;

      const blockedRepoLike = new Set([
        'topics',
        'search',
        'repositories',
        'projects',
        'packages',
        'stars',
        'followers',
        'following'
      ]);
      if (blockedRepoLike.has(repo)) return false;

      return true;
    } catch {
      return false;
    }
  }

  platformFromUrl(rawUrl) {
    try {
      const hostname = new URL(rawUrl).hostname.toLowerCase();
      if (hostname.includes('github.com')) return 'GitHub';
      if (hostname.includes('medium.com')) return 'Medium';
      if (hostname.includes('owasp.org')) return 'OWASP';
      if (hostname.includes('portswigger.net')) return 'PortSwigger';
      if (hostname.includes('tryhackme.com')) return 'TryHackMe';
      if (hostname.includes('hackthebox.com')) return 'Hack The Box';
      if (hostname.includes('sans.org')) return 'SANS';
      if (hostname.includes('nist.gov')) return 'NIST';
      if (hostname.includes('cisa.gov')) return 'CISA';
      if (hostname.includes('reddit.com')) return 'Reddit';

      return hostname.replace(/^www\./, '');
    } catch {
      return 'Unknown';
    }
  }

  inferType({ title, snippet, link }) {
    const text = `${title || ''} ${snippet || ''} ${link || ''}`.toLowerCase();
    const hostname = this.platformFromUrl(link).toLowerCase();

    if (hostname.includes('github') || /site:github|repo|repository/.test(text)) return 'github';
    if (
      /walkthrough|walk-through|writeup|write-up|ctf|room walkthrough|machine walkthrough/.test(text)
    ) {
      return 'walkthrough';
    }
    if (
      /book|ebook|handbook|textbook|packt|oreilly|o'reilly|nostarch|no starch|wiley|springer/.test(text)
    ) {
      return 'books';
    }
    if (
      hostname.includes('medium')
      || /blog|substack|dev\.to|wordpress/.test(text)
    ) {
      return 'blogs';
    }

    return 'articles';
  }

  async searchOnce(apiKey, query, num = 10) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: Math.min(Math.max(Number.parseInt(num, 10) || 10, 5), 20)
        })
      });

      if (!response.ok) {
        const error = new Error(`Serper search failed (${response.status})`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const organic = Array.isArray(data?.organic) ? data.organic : [];

      return organic
        .map((item) => ({
          title: typeof item?.title === 'string' ? item.title.trim() : '',
          link: typeof item?.link === 'string' ? item.link.trim() : '',
          snippet: typeof item?.snippet === 'string' ? item.snippet.trim() : ''
        }))
        .filter((item) => item.title && this.isValidUrl(item.link));
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchWithFailover(query, num = 10) {
    if (this.apiKeys.length === 0) {
      throw new Error('SERPER_API_KEY (or SERPER_API_KEY_2 / SERPER_API_KEYS) is not set.');
    }

    const isFailoverStatus = (status) => [401, 403, 429, 500, 502, 503, 504].includes(Number(status));
    let lastError = null;

    for (let i = 0; i < this.apiKeys.length; i += 1) {
      try {
        return await this.searchOnce(this.apiKeys[i], query, num);
      } catch (error) {
        lastError = error;
        const status = error?.status;
        const shouldFailover = status ? isFailoverStatus(status) : true;
        const canRetry = shouldFailover && i < this.apiKeys.length - 1;

        this.logger?.warn?.('Serper resource search attempt failed', {
          attempt: i + 1,
          totalKeys: this.apiKeys.length,
          status: typeof status === 'number' ? status : null,
          error: error?.message || String(error),
          failover: canRetry
        });

        if (!canRetry) break;
      }
    }

    throw lastError || new Error('Serper resource search failed.');
  }

  async searchResources({ query, type = 'all', limit = 5 } = {}) {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 5, 3), 20);
    const safeType = this.normalizeType(type);
    const queries = this.buildQueries(query, safeType).slice(0, safeType === 'all' ? 5 : 3);

    const settled = await Promise.allSettled(
      queries.map((q) => this.searchWithFailover(q, Math.max(8, safeLimit * 2)))
    );

    const merged = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        merged.push(...result.value);
      } else {
        this.logger?.warn?.('One resource query failed', {
          error: result.reason?.message || String(result.reason)
        });
      }
    }

    const seen = new Set();
    const normalized = [];

    for (const item of merged) {
      if (!item?.link || seen.has(item.link)) continue;
      seen.add(item.link);

      const inferredType = this.inferType(item);
      if (safeType !== 'all' && inferredType !== safeType) continue;
      if (inferredType === 'github' && !this.isUsefulGitHubRepoUrl(item.link)) continue;

      normalized.push({
        name: item.title,
        summary: item.snippet || 'No short summary available for this resource.',
        platform: this.platformFromUrl(item.link),
        type: inferredType,
        link: item.link
      });
    }

    // If strict type filtering returns nothing, fallback to best-effort mixed results.
    if (normalized.length === 0 && safeType !== 'all') {
      const fallbackSeen = new Set();
      for (const item of merged) {
        if (!item?.link) continue;
        if (fallbackSeen.has(item.link)) continue;
        fallbackSeen.add(item.link);
        const inferredType = this.inferType(item);
        if (inferredType === 'github' && !this.isUsefulGitHubRepoUrl(item.link)) continue;

        normalized.push({
          name: item.title,
          summary: item.snippet || 'No short summary available for this resource.',
          platform: this.platformFromUrl(item.link),
          type: inferredType,
          link: item.link
        });
        if (normalized.length >= safeLimit) break;
      }
      return normalized.slice(0, safeLimit);
    }

    return normalized.slice(0, safeLimit);
  }
}

module.exports = ResourceSearchService;
