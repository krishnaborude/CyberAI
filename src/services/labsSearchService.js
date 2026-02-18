const { URL } = require('node:url');

class LabsSearchService {
  constructor({ apiKey, apiKeys, logger }) {
    const keys = Array.isArray(apiKeys) ? apiKeys : [];
    const legacy = apiKey ? [apiKey] : [];
    this.apiKeys = [...legacy, ...keys].map((k) => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);
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
    return this.apiKeys.length > 0;
  }

  parseLabInput(input) {
    if (typeof input === 'string') {
      return { link: input, title: '', snippet: '' };
    }
    if (input && typeof input === 'object') {
      return {
        link: typeof input.link === 'string' ? input.link : '',
        title: typeof input.title === 'string' ? input.title : '',
        snippet: typeof input.snippet === 'string' ? input.snippet : ''
      };
    }
    return { link: '', title: '', snippet: '' };
  }

  hasPremiumSignal(input) {
    const { link, title, snippet } = this.parseLabInput(input);
    const text = `${title} ${snippet} ${link}`.toLowerCase();
    return /premium|subscribe|subscription|required plan|paid plan|upgrade|members only|pro only|unlocked with/i.test(text)
      || /why-subscribe|roomcode=|modulecode=/.test(text);
  }

  isLikelyTryHackMeFree(input) {
    const { link } = this.parseLabInput(input);
    try {
      const url = new URL(link);
      const host = url.hostname.toLowerCase();
      const path = url.pathname || '/';
      if (host !== 'tryhackme.com' && host !== 'www.tryhackme.com') return false;
      if (path.startsWith('/why-subscribe')) return false;
      if (!(path.startsWith('/room/') || path.startsWith('/module/'))) return false;
      if (this.hasPremiumSignal(input)) return false;
      return true;
    } catch {
      return false;
    }
  }

  isLikelyTryHackMePaid(input) {
    const { link } = this.parseLabInput(input);
    try {
      const url = new URL(link);
      const host = url.hostname.toLowerCase();
      const path = url.pathname || '/';
      if (host !== 'tryhackme.com' && host !== 'www.tryhackme.com') return false;
      if (path.startsWith('/path/') || path.startsWith('/r/path/') || path.startsWith('/why-subscribe')) return true;
      return this.hasPremiumSignal(input);
    } catch {
      return false;
    }
  }

  isLikelyPaidLabUrl(input) {
    const { link } = this.parseLabInput(input);
    try {
      const url = new URL(link);
      const host = url.hostname.toLowerCase();
      const path = url.pathname || '/';

      // These platforms have mixed free/paid content.
      // Use conservative URL heuristics so "paid" mode does not leak obvious free tracks.
      if (host === 'tryhackme.com' || host === 'www.tryhackme.com') {
        return this.isLikelyTryHackMePaid(input);
      }

      if (host === 'app.hackthebox.com') {
        return path === '/tracks'
          || path.startsWith('/tracks/')
          || path === '/challenges'
          || path.startsWith('/challenges/');
      }

      // HTB Academy content is typically subscription-gated.
      if (host === 'academy.hackthebox.com') {
        return path.startsWith('/course/') || path.startsWith('/module/');
      }

      return this.accessHosts.paid.has(host);
    } catch {
      return false;
    }
  }

  isLikelyFreeLabUrl(input) {
    const { link } = this.parseLabInput(input);
    try {
      const url = new URL(link);
      const host = url.hostname.toLowerCase();
      const path = url.pathname || '/';

      if (this.accessHosts.free.has(host)) return true;

      if (host === 'tryhackme.com' || host === 'www.tryhackme.com') {
        return this.isLikelyTryHackMeFree(input);
      }

      if (host === 'app.hackthebox.com') {
        return path.startsWith('/starting-point');
      }

      return false;
    } catch {
      return false;
    }
  }

  isAllowedByAccess(input, access = 'any') {
    const a = typeof access === 'string' ? access.trim().toLowerCase() : 'any';
    if (a === 'any') return true;
    const { link } = this.parseLabInput(input);

    try {
      const host = new URL(link).hostname.toLowerCase();
      if (a === 'paid') {
        const paidHosts = this.accessHosts.paid;
        if (!paidHosts.has(host)) return false;
        return this.isLikelyPaidLabUrl(input);
      }
      if (a === 'free') {
        return this.isLikelyFreeLabUrl(input);
      }
      return true;
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
          || path === '/tracks'
          || path.startsWith('/tracks/')
          || path === '/challenges'
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
    if (this.apiKeys.length === 0) {
      throw new Error('SERPER_API_KEY (or SERPER_API_KEY_2 / SERPER_API_KEYS) is not set.');
    }

    const q = typeof query === 'string' ? query.trim() : '';
    if (!q) return [];

    const attemptSearch = async (key) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'X-API-KEY': key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q,
            num: Math.min(Math.max(Number.parseInt(limit, 10) || 10, 5), 20)
          })
        });

        if (!response.ok) {
          const err = new Error(`Serper search failed (${response.status})`);
          err.status = response.status;
          throw err;
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
          .filter((item) => this.isAllowedByAccess(item, access))
          .filter((item) => this.isAllowedByPlatform(item.link, platform));
      } finally {
        clearTimeout(timeout);
      }
    };

    const isFailoverStatus = (status) => [401, 403, 429, 500, 502, 503, 504].includes(Number(status));

    let lastError = null;
    for (let i = 0; i < this.apiKeys.length; i += 1) {
      const key = this.apiKeys[i];
      try {
        return await attemptSearch(key);
      } catch (error) {
        lastError = error;
        const status = error?.status;
        const shouldFailover = status ? isFailoverStatus(status) : true;
        const canRetry = shouldFailover && i < this.apiKeys.length - 1;

        this.logger?.warn?.('Serper search attempt failed', {
          attempt: i + 1,
          totalKeys: this.apiKeys.length,
          status: typeof status === 'number' ? status : null,
          error: error?.message || String(error),
          failover: canRetry
        });

        if (!canRetry) break;
      }
    }

    throw lastError || new Error('Serper search failed.');
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
      ? 'site:portswigger.net OR site:owasp.org OR site:overthewire.org OR site:play.picoctf.org OR site:tryhackme.com OR site:app.hackthebox.com'
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
      if (a === 'free') return [`${base} room OR module site:tryhackme.com`];
      if (a === 'paid') return [`${base} path site:tryhackme.com`];
      return [`${base} room OR module OR path site:tryhackme.com`];
    }
    if (p === 'htb_academy') {
      return [`${base} site:academy.hackthebox.com course OR site:academy.hackthebox.com module`];
    }
    if (p === 'htb_app') {
      if (a === 'free') {
        return [`${base} site:app.hackthebox.com starting point`];
      }
      if (a === 'paid') {
        return [`${base} site:app.hackthebox.com tracks OR site:app.hackthebox.com challenges`];
      }
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
        `${base} room OR module site:tryhackme.com`,
        `${base} site:app.hackthebox.com starting point`,
        `${base} site:owasp.org www-project juice shop OR site:owasp.org www-project webgoat`,
        `${base} wargames site:overthewire.org/wargames`,
        `${base} practice site:play.picoctf.org/practice`
      ];
    }

    if (a === 'paid') {
      return [
        `${base} path site:tryhackme.com`,
        `${base} site:academy.hackthebox.com course OR site:academy.hackthebox.com module`,
        `${base} site:app.hackthebox.com tracks OR site:app.hackthebox.com challenges`
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
