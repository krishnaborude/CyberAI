const { URL } = require('node:url');

class LabsSearchService {
  constructor({ apiKey, logger }) {
    this.apiKey = apiKey || null;
    this.logger = logger;

    // Prefer the platforms you asked for. Keep list tight so returned links are credible.
    this.allowedDomains = new Set([
      'tryhackme.com',
      'www.tryhackme.com',
      'app.hackthebox.com',
      'academy.hackthebox.com',
      'portswigger.net',
      'owasp.org',
      'overthewire.org',
      'play.picoctf.org'
    ]);
  }

  hasApiKey() {
    return Boolean(this.apiKey);
  }

  isAllowedUrl(raw) {
    if (!raw || typeof raw !== 'string') return false;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
      if (!this.allowedDomains.has(url.hostname)) return false;

      const path = url.pathname || '/';

      // Heuristics to keep results "lab-like" (avoid generic blog posts).
      if (url.hostname === 'portswigger.net') {
        if (!path.startsWith('/web-security/')) return false;
        if (path.includes('/cheat-sheet')) return false;
        if (path.includes('/learning-path')) return false;
        return path.includes('/lab') || path.endsWith('/all-labs');
      }

      if (url.hostname === 'tryhackme.com' || url.hostname === 'www.tryhackme.com') {
        return (
          path.startsWith('/room/')
          || path.startsWith('/module/')
          || path.startsWith('/path/')
          || path.startsWith('/r/path/')
        );
      }

      if (url.hostname === 'app.hackthebox.com') {
        return (
          path.startsWith('/starting-point')
          || path.startsWith('/machines/')
          || path.startsWith('/tracks/')
          || path.startsWith('/challenges/')
        );
      }

      if (url.hostname === 'academy.hackthebox.com') {
        return path.startsWith('/course/') || path.startsWith('/module/') || path === '/';
      }

      if (url.hostname === 'owasp.org') {
        return path.includes('/www-project');
      }

      if (url.hostname === 'overthewire.org') {
        return path.startsWith('/wargames/');
      }

      if (url.hostname === 'play.picoctf.org') {
        return path.startsWith('/practice');
      }

      return true;
    } catch {
      return false;
    }
  }

  async search({ query, limit = 10 } = {}) {
    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY is not set.');
    }

    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q,
          num: Math.min(Math.max(Number.parseInt(limit, 10) || 10, 5), 20)
        })
      });

      if (!response.ok) {
        throw new Error(`Serper search failed (${response.status})`);
      }

      const data = await response.json();
      const organic = Array.isArray(data?.organic) ? data.organic : [];

      return organic
        .map((item) => ({
          title: typeof item?.title === 'string' ? item.title.trim() : '',
          link: typeof item?.link === 'string' ? item.link.trim() : '',
          snippet: typeof item?.snippet === 'string' ? item.snippet.trim() : ''
        }))
        .filter((item) => item.title && item.link)
        .filter((item) => this.isAllowedUrl(item.link));
    } finally {
      clearTimeout(timeout);
    }
  }

  buildQuery(userQuery) {
    const q = typeof userQuery === 'string' ? userQuery.trim() : '';
    const platformHint = [
      'site:tryhackme.com OR site:app.hackthebox.com OR site:academy.hackthebox.com OR site:portswigger.net OR site:owasp.org'
    ].join(' ');
    return q ? `${q} labs ${platformHint}` : `cybersecurity labs ${platformHint}`;
  }

  buildPlatformQueries(userQuery) {
    const q = typeof userQuery === 'string' ? userQuery.trim() : '';
    const base = q || 'cybersecurity';

    // Separate queries helps Serper return non-PortSwigger results for topics where
    // PortSwigger dominates (e.g., XSS/SQLi).
    return [
      `${base} lab site:portswigger.net/web-security`,
      `${base} room site:tryhackme.com`,
      `${base} site:academy.hackthebox.com course OR site:academy.hackthebox.com module`,
      `${base} site:app.hackthebox.com starting point OR site:app.hackthebox.com machines OR site:app.hackthebox.com challenges`,
      `${base} site:owasp.org www-project juice shop OR site:owasp.org www-project webgoat`
    ];
  }

  normalizePlatformFromLink(link) {
    try {
      const host = new URL(link).hostname.toLowerCase();
      if (host.includes('portswigger.net')) return 'PortSwigger Web Security Academy';
      if (host.includes('tryhackme.com')) return 'TryHackMe';
      if (host.includes('hackthebox.com')) return 'Hack The Box';
      if (host.includes('owasp.org')) return 'OWASP';
      if (host.includes('overthewire.org')) return 'OverTheWire';
      if (host.includes('picoctf')) return 'picoCTF';
      if (host.includes('github.com')) return 'GitHub';
      return host;
    } catch {
      return '';
    }
  }

  toSearchContext(results, maxItems = 12) {
    const list = Array.isArray(results) ? results.slice(0, maxItems) : [];
    return list.map((r) => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet,
      platform_guess: this.normalizePlatformFromLink(r.link)
    }));
  }
}

module.exports = LabsSearchService;
