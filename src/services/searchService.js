// Serper.dev search wrapper (production-safe alternative to scraping).
// Docs: https://serper.dev/
class SearchService {
  constructor({ apiKey, logger }) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.endpoint = 'https://google.serper.dev/search';
  }

  enabled() {
    return Boolean(this.apiKey);
  }

  async search({ q, num = 8 }) {
    if (!this.enabled()) {
      throw new Error('Search service is not configured (missing SERPER_API_KEY).');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q, num })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Serper search failed: ${res.status} ${text}`);
      }

      const data = await res.json();
      const organic = Array.isArray(data?.organic) ? data.organic : [];

      return organic
        .map((item) => ({
          title: String(item.title || '').trim(),
          link: String(item.link || '').trim(),
          snippet: String(item.snippet || '').trim()
        }))
        .filter((item) => item.title && item.link);
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = SearchService;