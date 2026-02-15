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
    ),

  async execute(ctx) {
    const rawQuery = ctx.interaction.options.getString('query', true);
    const query = sanitizeUserInput(rawQuery, { maxChars: 200 });

    const validation = validateUserInput(query, { required: true });
    if (!validation.valid) {
      await ctx.interaction.reply({ content: validation.reason, ephemeral: true });
      return;
    }

    if (hasPromptInjection(query)) {
      await ctx.interaction.reply({
        content: 'Unsafe input pattern detected. Please provide a normal lab search query.',
        ephemeral: true
      });
      return;
    }

    const rate = ctx.rateLimiter.check(ctx.interaction.user.id);
    if (rate.limited) {
      const retryAfterSec = Math.ceil(rate.retryAfterMs / 1000);
      await ctx.interaction.reply({
        content: `Rate limit reached. Please wait ${retryAfterSec}s before sending another request.`,
        ephemeral: true
      });
      return;
    }

    if (!ctx.services.labsSearch?.hasApiKey?.()) {
      await ctx.interaction.reply({
        content: 'Live lab search is not configured. Set SERPER_API_KEY in .env and restart the bot.',
        ephemeral: true
      });
      return;
    }

    await ctx.interaction.deferReply();

    // 1) Search via Serper (real pages), 2) Use Gemini to select grounded labs with exact links.
    let labs = null;
    let searchContext = null;
    try {
      const queries = ctx.services.labsSearch.buildPlatformQueries(query);
      const settled = await Promise.allSettled(
        queries.map((q) => ctx.services.labsSearch.search({ query: q, limit: 8 }))
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
        limit: 5,
        diversity: { maxPerPlatform: 2, minPlatforms: 3 }
      });
    } catch (error) {
      ctx.logger.warn('Labs search/Gemini grounding failed', { error: error?.message || String(error) });
    }

    const clip = (text, maxLen) => {
      const value = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
      if (!value) return '';
      if (value.length <= maxLen) return value;
      return `${value.slice(0, Math.max(0, maxLen - 3))}...`;
    };

    const lines = [];
    lines.push(`Recommended labs for: ${query}`);
    lines.push('');

    if (Array.isArray(labs) && labs.length > 0) {
      labs.forEach((lab, index) => {
        lines.push(`${index + 1}) ${lab.lab_name}`);
        lines.push(`Platform: ${lab.platform}`);
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
      while (fallback.length < 5 && idx < 10) {
        for (const platformKey of platformOrder) {
          const list = buckets.get(platformKey) || [];
          if (list.length === 0) continue;
          const candidate = list.shift();
          if (candidate) fallback.push(candidate);
          if (fallback.length >= 5) break;
        }
        idx += 1;
      }

      (fallback.length > 0 ? fallback : searchContext.slice(0, 5)).forEach((item, index) => {
        lines.push(`${index + 1}) ${item.title}`);
        if (item.platform_guess) lines.push(`Platform: ${item.platform_guess}`);
        lines.push(`Link: <${item.link}>`);
        if (item.snippet) lines.push(`Description: ${clip(item.snippet, 220)}`);
        if (index !== fallback.length - 1) lines.push('');
      });
    } else {
      lines.push('No lab pages found. Try a more specific query (example: "XSS PortSwigger" or "Active Directory HTB Academy").');
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
