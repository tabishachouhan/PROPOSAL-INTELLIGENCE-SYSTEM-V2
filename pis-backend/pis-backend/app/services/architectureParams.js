const parseDurationDays = (opportunity) => {
  const text = (opportunity.interpreted?.constraints || []).join(' ').toLowerCase();
  const match = text.match(/(\d+)\s*[- ]?\s*day/);
  if (match) return parseInt(match[1], 10);
  return 3;
};

const parseFormat = (opportunity) => {
  const text = (opportunity.interpreted?.constraints || []).join(' ').toLowerCase();
  if (text.includes('virtual')) return 'virtual';
  if (text.includes('hybrid') || text.includes('blended')) return 'hybrid';
  if (text.includes('modular')) return 'modular';
  return 'residential';
};

const inferTemplate = (durationDays, format) => {
  if (durationDays <= 1) return 'intensive_1d';
  if (durationDays <= 3) return format === 'hybrid' ? 'hybrid_sprint' : 'intensive_3d';
  if (durationDays <= 6) return 'residential_5d';
  return 'modular_monthly';
};

const inferReinforcement = (durationDays) => {
  if (durationDays <= 2) return 'light';
  if (durationDays <= 5) return 'medium';
  return 'heavy';
};

const inferMeasurementDepth = (opportunity) => {
  const text = [
    ...(opportunity.interpreted?.goals || []),
    ...(opportunity.interpreted?.constraints || [])
  ].join(' ').toLowerCase();

  const businessKpiSignal = /\b(roi|revenue|kpi|business impact|cycle time|nps growth)\b/.test(text);
  const behaviourSignal = /\b(behaviour|behavior|on[- ]the[- ]job|manager involvement)\b/.test(text);

  if (businessKpiSignal) return 4;
  if (behaviourSignal) return 3;
  return 2;
};

const inferAudienceLevel = (opportunity) => {
  const text = (opportunity.interpreted?.audience?.value || '').toLowerCase();
  if (/\b(ceo|cxo|c-suite|c suite|board|chairman|managing director|president)\b/.test(text)) return 'Top';
  if (/\b(vp|vice president|director|senior manager|head of|general manager|\bgm\b)\b/.test(text)) return 'Senior';
  return 'Mid';
};

const CONTACT_HOUR_CEILING = { Mid: 7, Senior: 6, Top: 5 };

const MODALITY_DEFAULTS = {
  residential: { sync_in_person: 100, sync_virtual: 0, async_self_paced: 0, async_social: 0 },
  virtual: { sync_in_person: 0, sync_virtual: 70, async_self_paced: 30, async_social: 0 },
  hybrid: { sync_in_person: 50, sync_virtual: 0, async_self_paced: 30, async_social: 20 },
  modular: { sync_in_person: 30, sync_virtual: 30, async_self_paced: 30, async_social: 10 }
};
const inferModalityMix = (format) => ({ ...(MODALITY_DEFAULTS[format] || MODALITY_DEFAULTS.residential) });

const CHANNEL_SEEDS = {
  Mid: { lecture: 15, case: 20, simulation: 15, action_learning: 20, coaching: 10, peer_learning: 15, reflection: 5 },
  Senior: { lecture: 10, case: 25, simulation: 15, action_learning: 25, coaching: 10, peer_learning: 10, reflection: 5 },
  Top: { lecture: 5, case: 20, simulation: 10, action_learning: 35, coaching: 15, peer_learning: 10, reflection: 5 }
};
const inferChannelMix = (audienceLevel) => ({ ...(CHANNEL_SEEDS[audienceLevel] || CHANNEL_SEEDS.Mid) });

const inferDesignParameters = (opportunity) => {
  const total_duration_days = parseDurationDays(opportunity);
  const format = parseFormat(opportunity);
  const audience_level = inferAudienceLevel(opportunity);
  return {
    total_duration_days,
    format,
    template: inferTemplate(total_duration_days, format),
    reinforcement: inferReinforcement(total_duration_days),
    measurement_depth: inferMeasurementDepth(opportunity),
    audience_level,
    modality_mix: inferModalityMix(format),
    channel_mix: inferChannelMix(audience_level)
  };
};

const computeDerivedMetrics = (architectureResult, opportunity, designParameters) => {
  const acceptedCompetencies = (opportunity.competencies || [])
    .filter((c) => c.decision !== 'rejected')
    .map((c) => c.competency_id);

  const scheduledModuleTitles = new Set(
    (architectureResult.phases || [])
      .flatMap((p) => p.blocks || [])
      .flatMap((b) => b.modules || [])
  );
  const scheduledModules = (opportunity.modules || [])
    .filter((m) => scheduledModuleTitles.has(m.title));
  const coveredByModules = new Set(
    scheduledModules.flatMap((m) => m.competencies_covered || [])
  );
  const missing = acceptedCompetencies.filter((id) => !coveredByModules.has(id));
  const covered = acceptedCompetencies.length - missing.length;
  const facultyHours = {};
  let totalHours = 0;
  (architectureResult.phases || []).forEach((phase) => {
    (phase.blocks || []).forEach((block) => {
      const hrs = Number(block.duration_hrs) || 0;
      totalHours += hrs;
      if (block.faculty) {
        facultyHours[block.faculty] = (facultyHours[block.faculty] || 0) + hrs;
      }
    });
  });
  const facultyUtilisation = Object.entries(facultyHours).map(([name, hours]) => ({
    name,
    hours,
    pct: totalHours ? Math.round((hours / totalHours) * 100) : 0
  }));

  const modalityHours = { sync_in_person: 0, sync_virtual: 0, async_self_paced: 0, async_social: 0 };
  const channelHours = { lecture: 0, case: 0, simulation: 0, action_learning: 0, coaching: 0, peer_learning: 0, reflection: 0 };
  const competencyHours = {};

  (architectureResult.phases || []).forEach((phase) => {
    (phase.blocks || []).forEach((block) => {
      const hrs = Number(block.duration_hrs) || 0;
      if (block.modality && Object.prototype.hasOwnProperty.call(modalityHours, block.modality)) {
        modalityHours[block.modality] += hrs;
      }
      if (block.channel && Object.prototype.hasOwnProperty.call(channelHours, block.channel)) {
        channelHours[block.channel] += hrs;
      }
      const blockModules = (block.modules || [])
        .map((title) => scheduledModules.find((m) => m.title === title))
        .filter(Boolean);
      if (blockModules.length) {
        const hrsPerModule = hrs / blockModules.length;
        blockModules.forEach((m) => {
          (m.competencies_covered || []).forEach((cid) => {
            competencyHours[cid] = (competencyHours[cid] || 0) + hrsPerModule;
          });
        });
      }
    });
  });

  const toPct = (hoursMap) => Object.fromEntries(
    Object.entries(hoursMap).map(([k, v]) => [k, totalHours ? Math.round((v / totalHours) * 100) : 0])
  );
  const modalityActualMix = toPct(modalityHours);
  const channelActualMix = toPct(channelHours);

  const seventyTwentyTen = {
    formal: channelActualMix.lecture || 0,
    social: (channelActualMix.coaching || 0) + (channelActualMix.peer_learning || 0),
    experiential: (channelActualMix.case || 0) + (channelActualMix.simulation || 0)
      + (channelActualMix.action_learning || 0) + (channelActualMix.reflection || 0)
  };

  const audienceLevel = designParameters.audience_level || 'Mid';
  const dayHourCeiling = CONTACT_HOUR_CEILING[audienceLevel] || 7;

  const warnings = [];

  (architectureResult.phases || []).forEach((phase) => {
    const phaseHours = (phase.blocks || []).reduce((s, b) => s + (Number(b.duration_hrs) || 0), 0);
    if (phaseHours > dayHourCeiling) {
      warnings.push(`${phase.phase} is scheduled for ${phaseHours}h, above the ${dayHourCeiling}h/day guideline for a ${audienceLevel} audience`);
    }
  });

  const overFocused = Object.entries(competencyHours)
    .filter(([, hrs]) => totalHours > 0 && hrs / totalHours > 0.4)
    .map(([cid]) => cid);
  if (overFocused.length > 0) {
    warnings.push(
      `Competenc${overFocused.length === 1 ? 'y' : 'ies'} ${overFocused.join(', ')} account${overFocused.length === 1 ? 's' : ''} for over 40% of programme minutes`
    );
  }
  if (['Senior', 'Top'].includes(audienceLevel) && channelActualMix.lecture > 25) {
    warnings.push(`Lecture is ${channelActualMix.lecture}% of programme time for a ${audienceLevel} audience, above the 25% guideline from the 70-20-10 framework`);
  }

  const modalityTarget = designParameters.modality_mix || {};
  Object.keys(modalityHours).forEach((channel) => {
    const target = Number(modalityTarget[channel]) || 0;
    const actual = modalityActualMix[channel] || 0;
    if (Math.abs(actual - target) > 10) {
      warnings.push(`Modality "${channel.replace(/_/g, ' ')}" is placed at ${actual}% vs a ${target}% target, more than 10 points off`);
    }
  });

  if (missing.length > 0) {
    warnings.push(
      `${missing.length} accepted competenc${missing.length === 1 ? 'y is' : 'ies are'} not covered by any module: ${missing.join(', ')}`
    );
  }

  facultyUtilisation
    .filter((f) => f.pct > 35)
    .forEach((f) => warnings.push(`${f.name} carries ${f.pct}% of total contact hours, above the 35% guideline`));

  const durationDays = architectureResult.total_days || designParameters.total_duration_days;
  const hasCapstone = (architectureResult.phases || []).some(
    (p) =>
      /capstone/i.test(p.phase || '') ||
      (p.blocks || []).some((b) => /capstone/i.test(b.title || ''))
  );
  if (durationDays >= 3 && ['medium', 'heavy'].includes(designParameters.reinforcement) && !hasCapstone) {
    warnings.push('Programme is 3+ days with medium/heavy reinforcement but has no capstone element');
  }

  return {
    competency_coverage: { covered, total: acceptedCompetencies.length, missing },
    faculty_utilisation: facultyUtilisation,
    modality_actual_mix: modalityActualMix,
    channel_actual_mix: channelActualMix,
    seventy_twenty_ten: seventyTwentyTen,
    warnings
  };
};

module.exports = { inferDesignParameters, computeDerivedMetrics, inferModalityMix, inferChannelMix, inferAudienceLevel };
