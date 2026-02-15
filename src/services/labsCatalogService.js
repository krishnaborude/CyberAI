class LabsCatalogService {
  constructor() {
    this.catalog = {
      general: [
        {
          title: 'TryHackMe - Learning Paths',
          url: 'https://tryhackme.com/r/path/outline/presecurity',
          levels: ['beginner', 'intermediate'],
          why: 'Guided learning paths with hands-on rooms; strong fundamentals.'
        },
        {
          title: 'Hack The Box Academy',
          url: 'https://academy.hackthebox.com/',
          levels: ['beginner', 'intermediate', 'advanced'],
          why: 'Deep, job-aligned modules with labs and clear skill checkpoints.'
        },
        {
          title: 'PortSwigger Web Security Academy',
          url: 'https://portswigger.net/web-security',
          levels: ['beginner', 'intermediate', 'advanced'],
          why: 'Best web security labs with theory + practice and precise success criteria.'
        },
        {
          title: 'OverTheWire Wargames',
          url: 'https://overthewire.org/wargames/',
          levels: ['beginner', 'intermediate'],
          why: 'Build Linux, networking, and scripting skills through progressive challenges.'
        },
        {
          title: 'picoCTF Practice',
          url: 'https://play.picoctf.org/',
          levels: ['beginner', 'intermediate'],
          why: 'Beginner-friendly CTF puzzles across crypto, web, reversing, and forensics.'
        },
        {
          title: 'Blue Team Labs Online',
          url: 'https://blueteamlabs.online/',
          levels: ['intermediate', 'advanced'],
          why: 'Blue-team investigations using realistic logs, PCAPs, and artifacts.'
        }
      ],

      web: [
        {
          title: 'PortSwigger SQL Injection Labs',
          url: 'https://portswigger.net/web-security/sql-injection',
          levels: ['beginner', 'intermediate', 'advanced'],
          why: 'Hands-on SQLi variants (union, blind, time-based) with clear outcomes.'
        },
        {
          title: 'OWASP Juice Shop',
          url: 'https://owasp.org/www-project-juice-shop/',
          levels: ['beginner', 'intermediate'],
          why: 'Modern vulnerable app to practice OWASP Top 10 safely.'
        },
        {
          title: 'DVWA',
          url: 'https://github.com/digininja/DVWA',
          levels: ['beginner', 'intermediate'],
          why: 'Classic vulnerable web app with adjustable difficulty for step-by-step learning.'
        },
        {
          title: 'bWAPP',
          url: 'https://github.com/raesene/bWAPP',
          levels: ['beginner', 'intermediate'],
          why: 'Broad coverage of web vulnerabilities for building breadth after basics.'
        },
        {
          title: 'WebGoat',
          url: 'https://owasp.org/www-project-webgoat/',
          levels: ['beginner', 'intermediate'],
          why: 'Lesson-based labs that teach root causes and secure coding habits.'
        }
      ],

      network: [
        {
          title: 'TryHackMe Nmap Room',
          url: 'https://tryhackme.com/room/furthernmap',
          levels: ['beginner', 'intermediate'],
          why: 'Teaches safe scanning fundamentals and interpreting results.'
        },
        {
          title: 'Wireshark Documentation',
          url: 'https://www.wireshark.org/docs/',
          levels: ['beginner', 'intermediate'],
          why: 'Learn packet analysis: TCP, DNS, HTTP(S), and troubleshooting workflows.'
        },
        {
          title: 'Hack The Box - Starting Point',
          url: 'https://app.hackthebox.com/starting-point',
          levels: ['beginner', 'intermediate'],
          why: 'Beginner boxes with guided learning for recon and enumeration.'
        },
        {
          title: 'Security Onion',
          url: 'https://securityonionsolutions.com/software/',
          levels: ['intermediate', 'advanced'],
          why: 'Practice network monitoring and detection with a real NSM/SIEM stack.'
        }
      ],

      cloud: [
        {
          title: 'AWS CloudGoat',
          url: 'https://github.com/RhinoSecurityLabs/cloudgoat',
          levels: ['intermediate', 'advanced'],
          why: 'Realistic AWS vulnerable scenarios focused on IAM and misconfigurations.'
        },
        {
          title: 'Flaws Cloud',
          url: 'https://flaws.cloud/',
          levels: ['beginner', 'intermediate'],
          why: 'Intro to common cloud mistakes (S3/IAM) with a clear path.'
        },
        {
          title: 'Azure Goat',
          url: 'https://github.com/ine-labs/AzureGoat',
          levels: ['intermediate', 'advanced'],
          why: 'Azure vulnerable lab for identity, access control, and secure configuration.'
        },
        {
          title: 'GCP Goat',
          url: 'https://github.com/ine-labs/GCPGoat',
          levels: ['intermediate', 'advanced'],
          why: 'GCP vulnerable lab scenarios to learn secure defaults and access control.'
        }
      ],

      forensics: [
        {
          title: 'Autopsy Training',
          url: 'https://www.autopsy.com/support/training/',
          levels: ['beginner', 'intermediate'],
          why: 'Learn disk forensics fundamentals and artifact-driven investigations.'
        },
        {
          title: 'Volatility Foundation',
          url: 'https://www.volatilityfoundation.org/',
          levels: ['intermediate', 'advanced'],
          why: 'Memory forensics framework for process and artifact extraction.'
        },
        {
          title: 'CyberDefenders Challenges',
          url: 'https://cyberdefenders.org/blueteam-ctf-challenges/',
          levels: ['beginner', 'intermediate', 'advanced'],
          why: 'Hands-on DFIR with PCAPs/logs/malware artifacts and scoring.'
        },
        {
          title: 'DFIR Diva Resources',
          url: 'https://dfirdiva.com/dfir-training/',
          levels: ['beginner', 'intermediate'],
          why: 'Curated DFIR resources to strengthen investigation fundamentals.'
        }
      ],

      detection: [
        {
          title: 'DetectionLab',
          url: 'https://github.com/clong/DetectionLab',
          levels: ['intermediate', 'advanced'],
          why: 'Build a Windows logging lab (Sysmon/ELK) to practice detections end-to-end.'
        },
        {
          title: 'SOC Analyst Path (TryHackMe)',
          url: 'https://tryhackme.com/path/outline/soclevel1',
          levels: ['beginner', 'intermediate'],
          why: 'Guided SOC workflow: triage, investigation, and alert handling.'
        },
        {
          title: 'Sigma Rules',
          url: 'https://github.com/SigmaHQ/sigma',
          levels: ['intermediate', 'advanced'],
          why: 'Learn detection engineering with portable SIEM rule patterns.'
        },
        {
          title: 'Splunk Boss of the SOC',
          url: 'https://www.splunk.com/en_us/blog/security/introducing-boss-of-the-soc-bots-v3.html',
          levels: ['beginner', 'intermediate'],
          why: 'Practice searching and SOC triage skills in a game-like challenge.'
        }
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

    const lines = links.map((item, index) => {
      const why = item.why ? ` - ${item.why}` : '';
      return `${index + 1}. [${item.title}](${item.url})${why}`;
    });

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