class LabsCatalogService {
  constructor() {
    this.catalog = {
      general: [
        { title: 'TryHackMe - Learning Paths', url: 'https://tryhackme.com/r/path/outline/presecurity', levels: ['beginner', 'intermediate'] },
        { title: 'Hack The Box Academy', url: 'https://academy.hackthebox.com/', levels: ['beginner', 'intermediate', 'advanced'] },
        { title: 'PortSwigger Web Security Academy', url: 'https://portswigger.net/web-security', levels: ['beginner', 'intermediate', 'advanced'] },
        { title: 'OverTheWire Wargames', url: 'https://overthewire.org/wargames/', levels: ['beginner', 'intermediate'] },
        { title: 'picoCTF Practice', url: 'https://play.picoctf.org/', levels: ['beginner', 'intermediate'] },
        { title: 'Blue Team Labs Online', url: 'https://blueteamlabs.online/', levels: ['intermediate', 'advanced'] }
      ],
      web: [
        { title: 'PortSwigger SQL Injection Labs', url: 'https://portswigger.net/web-security/sql-injection', levels: ['beginner', 'intermediate', 'advanced'] },
        { title: 'OWASP Juice Shop', url: 'https://owasp.org/www-project-juice-shop/', levels: ['beginner', 'intermediate'] },
        { title: 'DVWA', url: 'https://github.com/digininja/DVWA', levels: ['beginner', 'intermediate'] },
        { title: 'bWAPP', url: 'https://github.com/raesene/bWAPP', levels: ['beginner', 'intermediate'] },
        { title: 'WebGoat', url: 'https://owasp.org/www-project-webgoat/', levels: ['beginner', 'intermediate'] }
      ],
      network: [
        { title: 'TryHackMe Nmap Room', url: 'https://tryhackme.com/room/furthernmap', levels: ['beginner', 'intermediate'] },
        { title: 'Wireshark Training', url: 'https://www.wireshark.org/docs/', levels: ['beginner', 'intermediate'] },
        { title: 'Hack The Box - Starting Point', url: 'https://app.hackthebox.com/starting-point', levels: ['beginner', 'intermediate'] },
        { title: 'Security Onion Labs', url: 'https://securityonionsolutions.com/software/', levels: ['intermediate', 'advanced'] }
      ],
      cloud: [
        { title: 'AWS CloudGoat', url: 'https://github.com/RhinoSecurityLabs/cloudgoat', levels: ['intermediate', 'advanced'] },
        { title: 'Flaws Cloud', url: 'https://flaws.cloud/', levels: ['beginner', 'intermediate'] },
        { title: 'Azure Goat', url: 'https://github.com/ine-labs/AzureGoat', levels: ['intermediate', 'advanced'] },
        { title: 'GCP Goat', url: 'https://github.com/ine-labs/GCPGoat', levels: ['intermediate', 'advanced'] }
      ],
      forensics: [
        { title: 'Autopsy Training', url: 'https://www.autopsy.com/support/training/', levels: ['beginner', 'intermediate'] },
        { title: 'Volatility Foundation', url: 'https://www.volatilityfoundation.org/', levels: ['intermediate', 'advanced'] },
        { title: 'CyberDefenders Labs', url: 'https://cyberdefenders.org/blueteam-ctf-challenges/', levels: ['beginner', 'intermediate', 'advanced'] },
        { title: 'DFIR Diva Resources', url: 'https://dfirdiva.com/dfir-training/', levels: ['beginner', 'intermediate'] }
      ],
      detection: [
        { title: 'DetectionLab', url: 'https://github.com/clong/DetectionLab', levels: ['intermediate', 'advanced'] },
        { title: 'SOC Analyst Learning Path (TryHackMe)', url: 'https://tryhackme.com/path/outline/soclevel1', levels: ['beginner', 'intermediate'] },
        { title: 'Sigma Rules', url: 'https://github.com/SigmaHQ/sigma', levels: ['intermediate', 'advanced'] },
        { title: 'Splunk Boss of the SOC', url: 'https://www.splunk.com/en_us/blog/security/introducing-boss-of-the-soc-bots-v3.html', levels: ['beginner', 'intermediate'] }
      ]
    };
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

  normalizeLevel(level = '') {
    const value = String(level).toLowerCase();
    if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
      return value;
    }
    return 'beginner';
  }

  getLinks({ track, level, limit = 6 }) {
    const normalizedTrack = this.normalizeTrack(track);
    const normalizedLevel = this.normalizeLevel(level);

    const primary = this.catalog[normalizedTrack] || [];
    const general = this.catalog.general || [];

    const matchesLevel = (item) => item.levels.includes(normalizedLevel);

    const selected = [
      ...primary.filter(matchesLevel),
      ...primary.filter((item) => !matchesLevel(item)),
      ...general.filter(matchesLevel),
      ...general.filter((item) => !matchesLevel(item))
    ];

    const unique = [];
    const seen = new Set();
    for (const item of selected) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      unique.push(item);
    }

    return {
      track: normalizedTrack,
      level: normalizedLevel,
      links: unique.slice(0, limit)
    };
  }

  formatLinksSection({ track, level, links }) {
    if (!Array.isArray(links) || links.length === 0) {
      return '';
    }

    const titleTrack = track.charAt(0).toUpperCase() + track.slice(1);
    const titleLevel = level.charAt(0).toUpperCase() + level.slice(1);

    const lines = links.map((item, index) => `${index + 1}. [${item.title}](${item.url})`);

    return [
      '## Recommended Legal Lab Links',
      `- Track: ${titleTrack}`,
      `- Level: ${titleLevel}`,
      '',
      ...lines,
      '',
      '_Use only authorized labs/CTFs and assets you own or have permission to test._'
    ].join('\n');
  }
}

module.exports = LabsCatalogService;