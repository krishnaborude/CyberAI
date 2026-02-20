function getField(userInput, label) {
  const input = typeof userInput === 'string' ? userInput : '';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*(.+)`, 'i');
  const match = input.match(re);
  return match ? match[1].trim() : '';
}

function parseStudyPlanInput(userInput) {
  return {
    certification: getField(userInput, 'Certification'),
    experienceLevel: getField(userInput, 'Experience Level'),
    hoursPerWeek: getField(userInput, 'Hours Per Week'),
    durationWeeks: getField(userInput, 'Duration (Weeks)'),
    focusArea: getField(userInput, 'Primary Focus Area')
  };
}

function buildCertificationGuidance(certification) {
  const cert = String(certification || '').trim();
  const certLabel = cert || 'selected certification';

  return [
    `- Certification target: "${certLabel}". Tailor all weeks to that exam style and expectations.`,
    '- Avoid generic one-size-fits-all roadmap language; make the flow certification-specific.',
    '- In Certification Alignment Notes, explicitly justify how structure, labs, reporting, and milestones match the certification.',
    '- Keep the workflow realistic and engagement-oriented (recon -> foothold -> escalation/pivot -> reporting/debrief).'
  ];
}

function buildFocusWeightingGuidance(focusArea, weeks) {
  const focus = String(focusArea || '').trim();
  if (!focus) {
    return [
      '- Keep topic weighting realistic to the learner profile and selected certification.'
    ];
  }

  const totalWeeks = Number.isFinite(weeks) ? weeks : 8;
  const dominantWeeks = Math.max(2, Math.ceil(totalWeeks * 0.6));
  const attackChainWeeks = Math.max(1, Math.ceil(totalWeeks * 0.2));
  const supportWeeks = Math.max(1, totalWeeks - dominantWeeks - attackChainWeeks);

  return [
    `- Focus dominance rule: "${focus}" should dominate at least ${dominantWeeks} of ${totalWeeks} weeks.`,
    `- Suggested pacing: ${dominantWeeks} weeks focus-dominant, ${supportWeeks} weeks supporting skills, ${attackChainWeeks} weeks attack-chain simulation + reporting.`,
    '- Ensure week flow feels like a real engagement, not disconnected topic blocks.'
  ];
}

function buildExperienceScalingGuidance(experienceLevel, focusArea) {
  const level = String(experienceLevel || '').trim().toLowerCase();
  const focus = String(focusArea || '').trim().toLowerCase();
  const isADFocused = focus.includes('active directory') || /\bad\b/.test(focus);

  if (level === 'beginner') {
    return [
      '- Experience-level scaling (Beginner): introduce core fundamentals before advanced attack techniques.',
      isADFocused
        ? '- Start with foundational Active Directory concepts (domain model, identities, trust boundaries, core protocols) before AD abuse paths.'
        : '- Introduce foundational concepts for the selected focus area before advanced tradecraft.',
      '- Delay advanced persistence/evasion topics until enumeration and initial-access fundamentals are consistently demonstrated.',
      '- Include structured repetition of enumeration workflow across multiple weeks and lab targets.'
    ];
  }

  if (level === 'intermediate') {
    return [
      '- Experience-level scaling (Intermediate): keep fundamentals concise, then increase attack-chain depth and troubleshooting complexity.',
      '- Use measurable progression from repeatable methodology to faster independent execution.'
    ];
  }

  if (level === 'advanced') {
    return [
      '- Experience-level scaling (Advanced): minimize basics, maximize complex chaining, edge-case handling, and rigorous reporting quality.'
    ];
  }

  return [
    '- Calibrate depth and pacing to the stated experience level with explicit progression.'
  ];
}

function buildIntensityGuidance(hoursPerWeek) {
  const hours = Number.parseInt(String(hoursPerWeek || '').trim(), 10);
  if (!Number.isFinite(hours) || hours < 25) {
    return [
      '- Keep weekly workload realistic for the provided hours-per-week constraint.'
    ];
  }

  return [
    `- Intensity mode enabled (${hours}h/week): include a suggested daily structure (for example 4-5 hour blocks).`,
    '- Include a weekend full-chain simulation block each week.',
    '- Include explicit time distribution percentages (enumeration %, exploitation %, reporting %).',
    '- Show how high-intensity cadence maps to measurable weekly deliverables.'
  ];
}

function buildStudyPlanPrompt({
  systemPrompt,
  commandGuidance,
  safetyRequirements,
  detailTemplate,
  commandRules,
  userInput,
  targetWeeks
}) {
  const weeks = Number.isFinite(targetWeeks) ? targetWeeks : 8;
  const parsed = parseStudyPlanInput(userInput);
  const certGuidance = buildCertificationGuidance(parsed.certification);
  const focusGuidance = buildFocusWeightingGuidance(parsed.focusArea, weeks);
  const experienceGuidance = buildExperienceScalingGuidance(parsed.experienceLevel, parsed.focusArea);
  const intensityGuidance = buildIntensityGuidance(parsed.hoursPerWeek);

  return [
    systemPrompt,
    '',
    'Study plan output requirements (strict):',
    '- Return only the study plan in clean markdown. No extra commentary.',
    '- Align all guidance to offensive security certification preparation in authorized lab environments.',
    '- Use exactly these H2 sections in this order:',
    '  1) ## Overview Summary',
    '  2) ## Weekly Breakdown',
    '  3) ## Skills Progression Milestones',
    '  4) ## Recommended Lab Types',
    '  5) ## Practice Strategy',
    '  6) ## Review & Reinforcement Plan',
    '  7) ## Final Exam Readiness Checklist',
    '  8) ## Certification Alignment Notes',
    '- Overview Summary must be 3-5 concise sentences.',
    '- Weekly Breakdown must be a markdown table with columns: Week | Focus | Objectives | Labs/Practice | Deliverable.',
    `- Include every week from Week 1 through Week ${weeks}, with no missing weeks.`,
    '- Keep each table cell concise (target 6-14 words).',
    '- Do not use HTML tags like <br> inside table cells.',
    '- Do not place bullet lists inside table cells.',
    '- Keep one concise objective block per row; avoid dense multi-line cells.',
    '- Outside the table, use flat "-" bullets only (no nested lists).',
    '- Keep plan realistic for the provided skill level and hours-per-week constraint.',
    '- Keep the full response compact and readable in Discord.',
    '- Week flow must be attack-chain oriented (external recon -> foothold -> escalation/pivot -> reporting).',
    '- Certification Alignment Notes must include at least 3 bullets explaining why the plan matches the selected certification.',
    '',
    'Certification-aware tailoring:',
    ...certGuidance,
    ...focusGuidance,
    ...experienceGuidance,
    ...intensityGuidance,
    '',
    'Safety requirements:',
    ...safetyRequirements,
    '',
    detailTemplate,
    commandRules ? '' : null,
    commandRules || null,
    '',
    `Command context: ${commandGuidance}`,
    `User request: ${userInput || 'No extra context provided.'}`
  ].filter(Boolean).join('\n');
}

module.exports = {
  buildStudyPlanPrompt
};
