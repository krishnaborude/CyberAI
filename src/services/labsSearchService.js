const { URL } = require('node:url');

class LabsSearchService {
  constructor({ apiKey, logger }) {
    this.apiKey = apiKey || null;
    this.logger = logger;

    this.accessHosts = {
      free: new Set(['portswigger.net', 'owasp.org', 'overthewire.org', 'play.picoctf.org']),
      paid: new Set(['tryhackme.com', 'www.tryhackme.com', 'academy.hackthebox.com', 'app.hackthebox.com'])
    };

    this.platformHosts = {
      tryhackme: new Set(['tryhackme.com', 'www.tryhackme.com']),
      htb_academy: new Set(['academy.hackthebox.com']),
      htb_app: new Set(['app.hackthebox.com']),
      portswigger: new Set(['portswigger.net']),
      owasp: new Set(['owasp.org']),
      overthewire: new Set(['overthewire.org']),
      picoctf: new Set(['play.picoctf.org'])
    };

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

  isAllowedByAccess(raw, access = 'any') {
    const a = typeof access === 'string' ? access.trim().toLowerCase() : 'any';
    if (a === 'any') return true;

    try {
      const host = new URL(raw).hostname.toLowerCase();
      const set = this.accessHosts[a];
      if (!set) return true;
      return set.has(host);
    } catch {
      return false;
    }
  }

  isAllowedByPlatform(raw, platform = 'any') {
    const p = typeof platform === 'string' ? platform.trim().toLowerCase() : 'any';
    if (p === 'any') return true;

    try {
      const host = new URL(raw).hostname.toLowerCase();
      const set = this.platformHosts[p];
      if (!set) return true;
      return set.has(host);
    } catch {
      return false;
    }
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

  async search({ query, limit = 10, access = 'any', platform = 'any' } = {}) {
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
        .filter((item) => this.isAllowedUrl(item.link))
        .filter((item) => this.isAllowedByAccess(item.link, access))
        .filter((item) => this.isAllowedByPlatform(item.link, platform));
    } finally {
      clearTimeout(timeout);
    }
  }

  buildQuery(userQuery, { access = 'any', platform = 'any' } = {}) {
    const q = typeof userQuery === 'string' ? userQuery.trim() : '';
    const a = typeof access === 'string' ? access.trim().toLowerCase() : 'any';
    const p = typeof platform === 'string' ? platform.trim().toLowerCase() : 'any';

    const platformHintByPlatform = p === 'tryhackme'
      ? 'site:tryhackme.com'
      : p === 'htb_academy'
        ? 'site:academy.hackthebox.com'
        : p === 'htb_app'
          ? 'site:app.hackthebox.com'
          : p === 'portswigger'
            ? 'site:portswigger.net'
            : p === 'owasp'
              ? 'site:owasp.org'
              : p === 'overthewire'
                ? 'site:overthewire.org'
                : p === 'picoctf'
                  ? 'site:play.picoctf.org'
                  : '';

    const platformHintByAccess = a === 'free'
      ? 'site:portswigger.net OR site:owasp.org OR site:overthewire.org OR site:play.picoctf.org'
      : a === 'paid'
        ? 'site:tryhackme.com OR site:app.hackthebox.com OR site:academy.hackthebox.com'
        : 'site:tryhackme.com OR site:app.hackthebox.com OR site:academy.hackthebox.com OR site:portswigger.net OR site:owasp.org OR site:overthewire.org OR site:play.picoctf.org';

    const platformHint = platformHintByPlatform || platformHintByAccess;
    return q ? `${q} labs ${platformHint}` : `cybersecurity labs ${platformHint}`;
  }

  buildPlatformQueries(userQuery, { access = 'any', platform = 'any' } = {}) {
    const q = typeof userQuery === 'string' ? userQuery.trim() : '';
    const base = q || 'cybersecurity';
    const a = typeof access === 'string' ? access.trim().toLowerCase() : 'any';
    const p = typeof platform === 'string' ? platform.trim().toLowerCase() : 'any';

    // If a single platform is requested, only query that platform.
    if (p === 'tryhackme') {
      return [`${base} room site:tryhackme.com`];
    }
    if (p === 'htb_academy') {
      return [`${base} site:academy.hackthebox.com course OR site:academy.hackthebox.com module`];
    }
    if (p === 'htb_app') {
      return [`${base} site:app.hackthebox.com starting point OR site:app.hackthebox.com machines OR site:app.hackthebox.com challenges`];
    }
    if (p === 'portswigger') {
      return [`${base} lab site:portswigger.net/web-security`];
    }
    if (p === 'owasp') {
      return [`${base} site:owasp.org www-project juice shop OR site:owasp.org www-project webgoat`];
    }
    if (p === 'overthewire') {
      return [`${base} wargames site:overthewire.org/wargames`];
    }
    if (p === 'picoctf') {
      return [`${base} practice site:play.picoctf.org/practice`];
    }

    // Separate queries helps Serper return non-PortSwigger results for topics where
    // PortSwigger dominates (e.g., XSS/SQLi).
    if (a === 'free') {
      return [
        `${base} lab site:portswigger.net/web-security`,
        `${base} site:owasp.org www-project juice shop OR site:owasp.org www-project webgoat`,
        `${base} wargames site:overthewire.org/wargames`,
        `${base} practice site:play.picoctf.org/practice`
      ];
    }

    if (a === 'paid') {
      return [
        `${base} room site:tryhackme.com`,
        `${base} site:academy.hackthebox.com course OR site:academy.hackthebox.com module`,
        `${base} site:app.hackthebox.com starting point OR site:app.hackthebox.com machines OR site:app.hackthebox.com challenges`
      ];
    }

    return [
      `${base} lab site:portswigger.net/web-security`,
      `${base} room site:tryhackme.com`,
      `${base} site:academy.hackthebox.com course OR site:academy.hackthebox.com module`,
      `${base} site:app.hackthebox.com starting point OR site:app.hackthebox.com machines OR site:app.hackthebox.com challenges`,
      `${base} site:owasp.org www-project juice shop OR site:owasp.org www-project webgoat`,
      `${base} wargames site:overthewire.org/wargames`,
      `${base} practice site:play.picoctf.org/practice`
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
