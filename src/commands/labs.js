const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { sanitizeUserInput, hasPromptInjection, validateUserInput } = require('../utils/inputGuard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('labs')
    .setDescription('Recommend practical cybersecurity labs based on a search query')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('What you want labs for (e.g., XSS, Active Directory, SOC detections, cloud misconfigurations)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('platform')
        .setDescription('Restrict results to a single platform')
        .addChoices(
          { name: 'Any', value: 'any' },
          { name: 'TryHackMe', value: 'tryhackme' },
          { name: 'Hack The Box Academy', value: 'htb_academy' },
          { name: 'Hack The Box (app)', value: 'htb_app' },
          { name: 'PortSwigger WSA', value: 'portswigger' },
          { name: 'OWASP', value: 'owasp' },
          { name: 'OverTheWire', value: 'overthewire' },
          { name: 'picoCTF', value: 'picoctf' }
        )
        .setRequired(false)
    ),

  async execute(ctx) {
    const rawQuery = ctx.interaction.options.getString('query', true);
    const query = sanitizeUserInput(rawQuery, { maxChars: 200 });
    const platform = (ctx.interaction.options.getString('platform') || 'any').toLowerCase();
    const requestedLimit = 5;

    const validation = validateUserInput(query, { required: true });
    if (!validation.valid) {
      await ctx.interaction.reply({ content: validation.reason, flags: MessageFlags.Ephemeral });
      return;
    }

    if (hasPromptInjection(query)) {
      await ctx.interaction.reply({
        content: 'Unsafe input pattern detected. Please provide a normal lab search query.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const rate = ctx.rateLimiter.check(ctx.interaction.user.id);
    if (rate.limited) {
      const retryAfterSec = Math.ceil(rate.retryAfterMs / 1000);
      await ctx.interaction.reply({
        content: `Rate limit reached. Please wait ${retryAfterSec}s before sending another request.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (!ctx.services.labsSearch?.hasApiKey?.()) {
      await ctx.interaction.reply({
        content: 'Live lab search is not configured. Set SERPER_API_KEY (or SERPER_API_KEY_2) in .env and restart the bot.',
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const platformLabel = (p) => {
      if (p === 'tryhackme') return 'TryHackMe';
      if (p === 'htb_academy') return 'Hack The Box Academy';
      if (p === 'htb_app') return 'Hack The Box (app)';
      if (p === 'portswigger') return 'PortSwigger Web Security Academy';
      if (p === 'owasp') return 'OWASP';
      if (p === 'overthewire') return 'OverTheWire';
      if (p === 'picoctf') return 'picoCTF';
      return 'Any';
    };

    await ctx.interaction.deferReply();

    const normalizeDifficulty = (value) => {
      const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
      if (!v) return '';
      if (v === 'beginner' || v === 'easy' || v === 'apprentice') return 'Beginner';
      if (v === 'intermediate' || v === 'medium' || v === 'practitioner') return 'Intermediate';
      if (v === 'advanced' || v === 'hard' || v === 'expert') return 'Advanced';
      return '';
    };

    const inferDifficulty = (text) => {
      const t = typeof text === 'string' ? text.toLowerCase() : '';
      if (!t) return 'Intermediate';
      if (/(?:^|[\s/(-])(easy|beginner|apprentice)(?:$|[\s/)-])/i.test(t)) return 'Beginner';
      if (/(?:^|[\s/(-])(medium|intermediate|practitioner)(?:$|[\s/)-])/i.test(t)) return 'Intermediate';
      if (/(?:^|[\s/(-])(hard|advanced|expert)(?:$|[\s/)-])/i.test(t)) return 'Advanced';
      return 'Intermediate';
    };

    // 1) Search via Serper (real pages), 2) Use Gemini to select grounded labs with exact links.
    let labs = null;
    let searchContext = null;
    let suggestionLabs = null;
    try {
      const queries = ctx.services.labsSearch.buildPlatformQueries(query, { platform });
      const perQueryLimit = Math.min(Math.max(requestedLimit * 3, 8), 20);
      const settled = await Promise.allSettled(
        queries.map((q) => ctx.services.labsSearch.search({ query: q, limit: perQueryLimit, platform }))
      );

      const merged = [];
      for (const entry of settled) {
        if (entry.status === 'fulfilled') merged.push(...entry.value);
        else ctx.logger.warn('One platform search failed', { error: entry.reason?.message || String(entry.reason) });
      }

      // De-dupe by link, then cap per platform so one site doesn't dominate context.
      const unique = [];
      const seen = new Set();
      for (const item of merged) {
        if (!item?.link || seen.has(item.link)) continue;
        seen.add(item.link);
        unique.push(item);
      }

      const context = ctx.services.labsSearch.toSearchContext(unique, 50);
      const buckets = new Map();
      for (const item of context) {
        const key = (item.platform_guess || 'Other').toLowerCase();
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      }

      const capped = [];
      const order = ['portswigger web security academy', 'tryhackme', 'hack the box', 'owasp', 'overthewire', 'picoctf'];
      for (const key of order) {
        const items = buckets.get(key) || [];
        capped.push(...items.slice(0, 8));
      }
      for (const [key, items] of buckets.entries()) {
        if (order.includes(key)) continue;
        capped.push(...items.slice(0, 4));
      }

      searchContext = capped.slice(0, 28);

      labs = await ctx.services.gemini.recommendLabsFromSearch({
        query,
        searchContext,
        limit: requestedLimit,
        diversity: {
          maxPerPlatform: platform === 'any' ? Math.max(2, Math.ceil(requestedLimit / 2)) : requestedLimit,
          minPlatforms: platform === 'any' ? Math.min(2, requestedLimit) : 1
        },
        platform
      });
    } catch (error) {
      ctx.logger.warn('Labs search/Gemini grounding failed', { error: error?.message || String(error) });
    }

    // If strict platform returns nothing, fetch broader suggestions.
    if (
      platform !== 'any'
      && (!Array.isArray(labs) || labs.length === 0)
      && (!Array.isArray(searchContext) || searchContext.length === 0)
    ) {
      try {
        const broaderQueries = ctx.services.labsSearch.buildPlatformQueries(query, { platform: 'any' });
        const broaderSettled = await Promise.allSettled(
          broaderQueries.map((q) => ctx.services.labsSearch.search({ query: q, limit: 12, platform: 'any' }))
        );

        const broaderMerged = [];
        for (const entry of broaderSettled) {
          if (entry.status === 'fulfilled') broaderMerged.push(...entry.value);
        }

        const broaderUnique = [];
        const broaderSeen = new Set();
        for (const item of broaderMerged) {
          if (!item?.link || broaderSeen.has(item.link)) continue;
          broaderSeen.add(item.link);
          broaderUnique.push(item);
        }

        const broaderContext = ctx.services.labsSearch.toSearchContext(broaderUnique, 24);
        if (broaderContext.length > 0) {
          suggestionLabs = await ctx.services.gemini.recommendLabsFromSearch({
            query,
            searchContext: broaderContext,
            limit: 3,
            diversity: { maxPerPlatform: 2, minPlatforms: 1 },
            platform: 'any'
          });
        }
      } catch (error) {
        ctx.logger.warn('Labs broad suggestion fallback failed', { error: error?.message || String(error) });
      }
    }

    const clip = (text, maxLen) => {
      const value = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
      if (!value) return '';
      if (value.length <= maxLen) return value;
      return `${value.slice(0, Math.max(0, maxLen - 3))}...`;
    };

    const lines = [];
    const platLabel = platformLabel(platform);
    lines.push(`**User Input:** ${query}`);
    lines.push('');
    lines.push(`Recommended labs for: ${query} (Platform: ${platLabel})`);
    lines.push('');

    if (Array.isArray(labs) && labs.length > 0) {
      labs.forEach((lab, index) => {
        lines.push(`${index + 1}) ${lab.lab_name}`);
        lines.push(`Platform: ${lab.platform}`);
        lines.push(`Difficulty: ${normalizeDifficulty(lab.difficulty) || inferDifficulty(`${lab.lab_name} ${lab.description} ${lab.platform}`)}`);
        // Wrap links in <> to prevent Discord from generating embeds/previews.
        lines.push(`Link: <${lab.link}>`);
        lines.push(`Description: ${clip(lab.description, 220)}`);
        if (index !== labs.length - 1) lines.push('');
      });
    } else if (Array.isArray(searchContext) && searchContext.length > 0) {
      // If Gemini fails, fall back to platform-diverse search results (still real links).
      const buckets = new Map();
      for (const item of searchContext) {
        const key = (item.platform_guess || 'Other').toLowerCase();
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      }

      const platformOrder = ['tryhackme', 'hack the box', 'portswigger web security academy', 'owasp', 'overthewire', 'picoctf', 'other'];
      const fallback = [];
      let idx = 0;
      while (fallback.length < requestedLimit && idx < 10) {
        for (const platformKey of platformOrder) {
          const list = buckets.get(platformKey) || [];
          if (list.length === 0) continue;
          const candidate = list.shift();
          if (candidate) fallback.push(candidate);
          if (fallback.length >= requestedLimit) break;
        }
        idx += 1;
      }

      const fallbackList = fallback.length > 0 ? fallback : searchContext.slice(0, requestedLimit);
      fallbackList.forEach((item, index) => {
        lines.push(`${index + 1}) ${item.title}`);
        if (item.platform_guess) lines.push(`Platform: ${item.platform_guess}`);
        lines.push(`Difficulty: ${inferDifficulty(`${item.title} ${item.snippet || ''}`)}`);
        lines.push(`Link: <${item.link}>`);
        if (item.snippet) lines.push(`Description: ${clip(item.snippet, 220)}`);
        if (index !== fallbackList.length - 1) lines.push('');
      });
    } else if (Array.isArray(suggestionLabs) && suggestionLabs.length > 0) {
      lines.push(`No exact lab match found for Platform: ${platLabel}.`);
      lines.push('Here are related suggestions:');
      lines.push('');

      suggestionLabs.forEach((lab, index) => {
        lines.push(`${index + 1}) ${lab.lab_name}`);
        lines.push(`Platform: ${lab.platform}`);
        lines.push(`Difficulty: ${normalizeDifficulty(lab.difficulty) || inferDifficulty(`${lab.lab_name} ${lab.description} ${lab.platform}`)}`);
        lines.push(`Link: <${lab.link}>`);
        lines.push(`Description: ${clip(lab.description, 220)}`);
        if (index !== suggestionLabs.length - 1) lines.push('');
      });

      lines.push('');
      lines.push('Tip: use `Platform: Any` to get more results for this topic.');
    } else {
      lines.push(`No lab pages found for Platform: ${platLabel}.`);
      lines.push('Try `Platform: Any` or a nearby topic (example: "web recon", "OSINT", or "search operators").');
    }

    const response = lines.join('\n').trim().slice(0, 1900);
    await ctx.interaction.editReply({
      content: response || 'No labs found for that query.',
      flags: MessageFlags.SuppressEmbeds
    });

    ctx.logger.info('Labs command completed', {
      userId: ctx.interaction.user.id,
      query,
      results: Array.isArray(labs) ? labs.length : 0
    });
  }
};
