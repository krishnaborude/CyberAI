const { SlashCommandBuilder } = require('discord.js');
const { sanitizeUserInput, hasPromptInjection, validateUserInput } = require('../utils/inputGuard');
const { smartSplitMessage } = require('../utils/smartSplitMessage');
const { sendChunkedResponse } = require('../utils/discordResponse');

function typeLabel(type) {
  if (type === 'articles') return 'Articles';
  if (type === 'blogs') return 'Blogs';
  if (type === 'github') return 'GitHub Repos';
  if (type === 'books') return 'Books';
  if (type === 'walkthrough') return 'Walkthroughs';
  return 'All';
}

function titleType(type) {
  if (type === 'github') return 'GitHub Repo';
  if (type === 'books') return 'Books';
  if (type === 'blogs') return 'Blogs';
  if (type === 'walkthrough') return 'Walkthrough';
  return 'Articles';
}

function clip(text, maxLen = 230) {
  const value = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 3))}...`;
}

function normalizeResourceType(type) {
  const value = typeof type === 'string' ? type.trim().toLowerCase() : '';
  if (value === 'articles') return 'articles';
  if (value === 'blogs') return 'blogs';
  if (value === 'github') return 'github';
  if (value === 'books') return 'books';
  if (value === 'walkthrough') return 'walkthrough';
  return 'articles';
}

function uniqueByLink(items) {
  const seen = new Set();
  const list = [];

  for (const item of Array.isArray(items) ? items : []) {
    const link = typeof item?.link === 'string' ? item.link.trim() : '';
    if (!link || seen.has(link)) continue;
    seen.add(link);
    list.push(item);
  }

  return list;
}

function selectDiverseResources(items, limit, requestedType) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 5, 3), 8);
  const unique = uniqueByLink(items);
  if (requestedType !== 'all') return unique.slice(0, safeLimit);

  const buckets = new Map([
    ['articles', []],
    ['blogs', []],
    ['github', []],
    ['books', []],
    ['walkthrough', []]
  ]);

  for (const item of unique) {
    const t = normalizeResourceType(item?.type);
    buckets.get(t).push(item);
  }

  const selected = [];
  const oneEachOrder = ['articles', 'blogs', 'books', 'github', 'walkthrough'];

  // Primary rule for "all": one resource from each type when available.
  for (const type of oneEachOrder) {
    const bucket = buckets.get(type) || [];
    if (bucket.length > 0) selected.push(bucket.shift());
  }

  // If some types are unavailable, fill remaining slots (up to 5 for all mode) from what exists.
  const target = Math.min(5, safeLimit);
  const fillOrder = ['articles', 'blogs', 'books', 'walkthrough', 'github'];
  let cursor = 0;
  while (selected.length < target) {
    const type = fillOrder[cursor % fillOrder.length];
    const bucket = buckets.get(type) || [];
    if (bucket.length > 0) {
      selected.push(bucket.shift());
    } else if (fillOrder.every((t) => (buckets.get(t) || []).length === 0)) {
      break;
    }
    cursor += 1;
  }

  return selected.slice(0, target);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resource')
    .setDescription('Search cybersecurity resources (articles, blogs, books, GitHub repos, walkthroughs)')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Topic to search (example: xss, ad pentest, malware analysis, soc)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Filter by resource type')
        .addChoices(
          { name: 'All (mixed)', value: 'all' },
          { name: 'Articles', value: 'articles' },
          { name: 'Blogs', value: 'blogs' },
          { name: 'GitHub Repos', value: 'github' },
          { name: 'Books', value: 'books' },
          { name: 'Walkthroughs', value: 'walkthrough' }
        )
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('How many results to show (3 to 8)')
        .setRequired(false)
        .setMinValue(3)
        .setMaxValue(8)
    ),

  async execute(ctx) {
    const rawQuery = ctx.interaction.options.getString('query', true);
    const query = sanitizeUserInput(rawQuery, { maxChars: 180 });
    const type = (ctx.interaction.options.getString('type') || 'all').toLowerCase();
    const userLimit = ctx.interaction.options.getInteger('limit') || 5;
    const limit = type === 'all' ? 5 : userLimit;

    const validation = validateUserInput(query, { required: true });
    if (!validation.valid) {
      await ctx.interaction.reply({ content: validation.reason, ephemeral: true });
      return;
    }

    if (hasPromptInjection(query)) {
      await ctx.interaction.reply({
        content: 'Unsafe input pattern detected. Please provide a normal cyber topic.',
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

    if (!ctx.services.resourceSearch?.hasApiKey?.()) {
      await ctx.interaction.reply({
        content: 'Live resource search is not configured. Set SERPER_API_KEY (or SERPER_API_KEY_2) in .env and restart the bot.',
        ephemeral: true
      });
      return;
    }

    await ctx.interaction.deferReply();

    let resources = [];
    let geminiValidated = false;
    try {
      const candidateLimit = type === 'all'
        ? Math.min(20, Math.max(userLimit * 3, 15))
        : Math.min(12, Math.max(limit + 4, limit));
      const searchResults = await ctx.services.resourceSearch.searchResources({
        query,
        type,
        limit: candidateLimit
      });

      if (Array.isArray(searchResults) && searchResults.length > 0) {
        try {
          const curated = await ctx.services.gemini.curateResourcesFromSearch({
            query,
            type,
            resources: searchResults,
            limit
          });

          if (Array.isArray(curated) && curated.length > 0) {
            const merged = uniqueByLink([...curated, ...searchResults]);
            resources = selectDiverseResources(merged, limit, type);
            geminiValidated = true;
          } else {
            resources = selectDiverseResources(searchResults, limit, type);
          }
        } catch (error) {
          ctx.logger.warn('Gemini resource curation failed, using search fallback', {
            error: error?.message || String(error),
            query,
            type
          });
          resources = selectDiverseResources(searchResults, limit, type);
        }
      }

      if (type === 'all') {
        const requiredTypes = ['articles', 'blogs', 'books', 'github', 'walkthrough'];
        const getMissingTypes = (list) => {
          const existing = new Set((Array.isArray(list) ? list : []).map((item) => normalizeResourceType(item?.type)));
          return requiredTypes.filter((t) => !existing.has(t));
        };

        let missingTypes = getMissingTypes(resources);
        if (missingTypes.length > 0) {
          const targeted = await Promise.allSettled(
            missingTypes.map((missingType) => ctx.services.resourceSearch.searchResources({
              query,
              type: missingType,
              limit: 5
            }))
          );

          const extra = [];
          for (const result of targeted) {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
              extra.push(...result.value);
            }
          }

          if (extra.length > 0) {
            resources = selectDiverseResources(uniqueByLink([...resources, ...extra]), limit, 'all');
            missingTypes = getMissingTypes(resources);
          }

          if (missingTypes.length > 0) {
            ctx.logger.warn('All-type response missing one or more categories after fallback search', {
              query,
              missingTypes
            });
          }
        }
      }
    } catch (error) {
      ctx.logger.error('Resource search failed', {
        error: error?.message || String(error),
        query,
        type
      });
    }

    const lines = [];
    lines.push(`**User Input:** ${query}`);
    lines.push('');
    lines.push(`Cyber resources for: ${query}`);
    lines.push(`Filter: ${typeLabel(type)} | Count: ${limit}`);
    lines.push('');

    if (!Array.isArray(resources) || resources.length === 0) {
      lines.push('No matching resources found.');
      lines.push('Try a broader query or use type: All.');
    } else {
      resources.forEach((item, index) => {
        lines.push(`${index + 1}) Name: ${clip(item.name, 140)}`);
        lines.push(`Description/Summary: ${clip(item.summary, 220)}`);
        lines.push(`Platform: ${item.platform || 'Unknown'}`);
        lines.push(`Type: ${titleType(item.type)}`);
        lines.push(`Link: <${item.link}>`);
        if (index !== resources.length - 1) lines.push('');
      });
    }

    const response = lines.join('\n').trim();
    const chunks = smartSplitMessage(response, { addPageHeader: false });

    await sendChunkedResponse(ctx.interaction, chunks);

    ctx.logger.info('Resource command completed', {
      userId: ctx.interaction.user.id,
      query,
      type,
      geminiValidated,
      results: Array.isArray(resources) ? resources.length : 0
    });
  }
};
