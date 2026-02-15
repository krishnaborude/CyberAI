const ALLOWED_DOMAINS = [
  'tryhackme.com',
  'hackthebox.com',
  'academy.hackthebox.com',
  'portswigger.net',
  'overthewire.org',
  'play.picoctf.org',
  'blueteamlabs.online',
  'cyberdefenders.org',
  'github.com',
  'owasp.org',
  'wireshark.org',
  'volatilityfoundation.org',
  'autopsy.com',
  'securityonionsolutions.com',
  'flaws.cloud'
];

class LabsDiscoveryService {
  constructor({ searchService, logger }) {
    this.search = searchService;
    this.logger = logger;
  }

  normalizeTrack(track = '') {
    const value = String(track).toLowerCase();
    if (value.includes('web')) return 'web';
    if (value.includes('net')) return 'network';
    if (value.includes('cloud')) return 'cloud';
    if (value.includes('forensic') || value.includes('dfir')) return 'forensics';
    if (value.includes('detect') || value.includes('soc') || value.includes('blue')) return 'detection';
    return 'general';
  }

  inferTrackFromTopic(topic = '') {
    const t = String(topic).toLowerCase();
    if (!t) return 'general';

    if (/(sql\s*injection|xss|csrf|ssrf|idor|ssti|xxe|burp|owasp|webgoat|juice\s*shop|dvwa)/i.test(t)) return 'web';
    if (/(wireshark|pcap|nmap|dns|tcp|udp|firewall|routing|snort|suricata)/i.test(t)) return 'network';
    if (/(aws|azure|gcp|iam|s3|cloud|kubernetes|k8s)/i.test(t)) return 'cloud';
    if (/(forensic|dfir|memory|volatility|autopsy|timeline|artifact)/i.test(t)) return 'forensics';
    if (/(soc|detection|sigma|yara|siem|splunk|elk|edr)/i.test(t)) return 'detection';

    return 'general';
  }

  normalizeLevel(level = '') {
    const value = String(level).toLowerCase();
    if (value === 'beginner' || value === 'intermediate' || value === 'advanced') return value;
    return 'beginner';
  }

  trackQuery(track) {
    const map = {
      general: 'cybersecurity labs CTF learning path',
      web: 'web security labs OWASP Juice Shop DVWA WebGoat PortSwigger academy',
      network: 'network security labs Wireshark Nmap TryHackMe room',
      cloud: 'cloud security labs AWS CloudGoat Flaws.cloud Azure Goat GCP Goat',
      forensics: 'digital forensics labs Autopsy Volatility CyberDefenders DFIR',
      detection: 'SOC detection labs DetectionLab Sigma rules Blue Team Labs'
    };
    return map[track] || map.general;
  }

  levelHint(level) {
    if (level === 'beginner') return 'beginner friendly';
    if (level === 'intermediate') return 'intermediate';
    return 'advanced';
  }

  domainAllowed(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  }

  dedupe(items) {
    const out = [];
    const seen = new Set();

    for (const item of items) {
      if (!item?.url || seen.has(item.url)) continue;
      seen.add(item.url);
      out.push(item);
    }

    return out;
  }

  clip(text, maxLen = 160) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (!value) return '';
    if (value.length <= maxLen) return value;
    return `${value.slice(0, maxLen - 3)}...`;
  }

  extractKeywords(topic) {
    const raw = String(topic || '').toLowerCase();
    if (!raw.trim()) return [];

    return raw
      .split(/[^a-z0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3)
      .filter((w) => !['labs', 'lab', 'practice', 'training', 'learn', 'learning', 'advanced', 'beginner', 'intermediate'].includes(w));
  }

  keywordScore(item, keywords) {
    if (!keywords || keywords.length === 0) return 1;
    const text = `${item.title} ${item.why} ${item.url}`.toLowerCase();
    let score = 0;
    for (const k of keywords) {
      if (text.includes(k)) score += 1;
    }
    return score;
  }

  isLikelyLabPage(url) {
    const value = String(url || '').toLowerCase();
    // Filter out marketing/collection pages that are not actual labs.
    if (/(\/blog\/|\/resources\/|\/catalogue\/|\/catalog\/|\/paths?\/|\/tracks?\/|\/pricing\/|\/about\/|\/docs\/|\/documentation\/)/i.test(value)) {
      return false;
    }
    return true;
  }

  buildQuery({ track, level, topic }) {
    let t = this.normalizeTrack(track);
    const inferred = this.inferTrackFromTopic(topic);
    if (t === 'general' && inferred !== 'general') t = inferred;
    const l = this.normalizeLevel(level);
    const base = topic && String(topic).trim()
      ? `cybersecurity lab ${String(topic).trim()} practice`
      : this.trackQuery(t);

    const operators = [
      '(lab OR labs OR room OR challenge OR practice)',
      '-blog -resources -catalogue -catalog -paths -tracks -pricing -docs'
    ].join(' ');

    // Keep query simple; do domain filtering after results return.
    return {
      t,
      l,
      qPrimary: `${base} ${this.levelHint(l)} ${operators}`.trim(),
      qFallback: `${base} ${operators}`.trim()
    };
  }

  async discover({ track, level, topic = '', limit = 8 }) {
    if (!this.search?.enabled?.()) {
      throw new Error('Search is not enabled.');
    }

    const { t, l, qPrimary, qFallback } = this.buildQuery({ track, level, topic });
    const keywords = this.extractKeywords(topic);

    const num = Math.max(20, limit * 3);
    const resultsPrimary = await this.search.search({ q: qPrimary, num });

    const toLabItems = (results) => results
      .filter((r) => this.domainAllowed(r.link))
      .filter((r) => this.isLikelyLabPage(r.link))
      .map((r) => ({
        title: r.title,
        url: r.link,
        why: this.clip(r.snippet, 180)
      }));

    let unique = this.dedupe(toLabItems(resultsPrimary));

    if (unique.length < limit) {
      const resultsFallback = await this.search.search({ q: qFallback, num });
      unique = this.dedupe([...unique, ...toLabItems(resultsFallback)]);
    }

    // If topic is provided, keep only items that actually match the topic keywords.
    if (keywords.length > 0) {
      unique = unique
        .map((item) => ({ item, score: this.keywordScore(item, keywords) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.item);
    }

    return {
      track: t,
      level: l,
      links: unique.slice(0, limit)
    };
  }

  format({ track, level, links }) {
    if (!Array.isArray(links) || links.length === 0) {
      return '## Labs\n\nNo results found. Try another track/level.';
    }

    const titleTrack = track.charAt(0).toUpperCase() + track.slice(1);
    const titleLevel = level.charAt(0).toUpperCase() + level.slice(1);

    const lines = links.map((item, i) => {
      const why = item.why ? `\n   - Why: ${item.why}` : '';
      return `${i + 1}. **${item.title}**\n   - Link: <${item.url}>${why}`;
    });

    return [
      '## Labs (Discovered Online)',
      `- Track: ${titleTrack}`,
      `- Level: ${titleLevel}`,
      '',
      ...lines,
      '',
      '_Use only authorized labs/CTFs and assets you own or have permission to test._'
    ].join('\n');
  }
}

module.exports = LabsDiscoveryService;
