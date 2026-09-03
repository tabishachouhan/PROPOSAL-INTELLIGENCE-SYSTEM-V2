const CONTACT_HOUR_CEILING = {
  Junior: 6,
  Mid: 7,
  Senior: 7,
  Top: 7
};

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (value === null || value === undefined || value === '') {
    return [];
  }

  return [String(value)];
};

const toText = (value) => {
  if (Array.isArray(value)) {
    return value.join(' ');
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};

const parseDurationDays = (opportunity) => {
  const constraints = opportunity?.interpreted?.constraints?.value;
  const text = toText(constraints).toLowerCase();

  const match = text.match(/(\d+)\s*[- ]?\s*day/);

  if (match) {
    return parseInt(match[1], 10);
  }

  return 3;
};


const parseFormat = (opportunity) => {
  const constraints = opportunity?.interpreted?.constraints?.value;
  const text = toText(constraints).toLowerCase();

  if (
    text.includes('virtual') ||
    text.includes('online') ||
    text.includes('remote')
  ) {
    return 'virtual';
  }

  if (
    text.includes('hybrid') ||
    text.includes('blended')
  ) {
    return 'hybrid';
  }

  if (
    text.includes('modular') ||
    text.includes('module')
  ) {
    return 'modular';
  }

  if (text.includes('residential')) {
    return 'residential';
  }

  return 'residential';
};


const inferTemplate = (opportunity) => {
  const goals = opportunity?.interpreted?.goals?.value;
  const themes = opportunity?.interpreted?.themes?.value;
  const problemStatement =
    opportunity?.interpreted?.problem_statement?.value;

  const text = [
    ...toArray(goals),
    ...toArray(themes),
    problemStatement ? String(problemStatement) : ''
  ]
    .join(' ')
    .toLowerCase();

  if (
    text.includes('leadership') ||
    text.includes('leader') ||
    text.includes('management')
  ) {
    return 'leadership';
  }

  if (
    text.includes('technical') ||
    text.includes('technology') ||
    text.includes('digital') ||
    text.includes('software') ||
    text.includes('engineering')
  ) {
    return 'technical';
  }

  if (
    text.includes('entrepreneur') ||
    text.includes('startup') ||
    text.includes('business')
  ) {
    return 'entrepreneurship';
  }

  if (
    text.includes('policy') ||
    text.includes('governance') ||
    text.includes('public')
  ) {
    return 'policy';
  }

  return 'standard';
};

const inferReinforcement = (opportunity) => {
  const goals = opportunity?.interpreted?.goals?.value;
  const constraints = opportunity?.interpreted?.constraints?.value;

  const text = [
    ...toArray(goals),
    ...toArray(constraints)
  ]
    .join(' ')
    .toLowerCase();

  if (
    text.includes('hands-on') ||
    text.includes('practical') ||
    text.includes('project') ||
    text.includes('application')
  ) {
    return 'project_based';
  }

  if (
    text.includes('assessment') ||
    text.includes('exam') ||
    text.includes('test')
  ) {
    return 'assessment_driven';
  }

  if (
    text.includes('practice') ||
    text.includes('repeated') ||
    text.includes('reinforcement')
  ) {
    return 'practice_based';
  }

  if (
    text.includes('case study') ||
    text.includes('case-study')
  ) {
    return 'case_based';
  }

  return 'mixed';
};


const inferMeasurementDepth = (opportunity) => {
  const goals = opportunity?.interpreted?.goals?.value;
  const constraints = opportunity?.interpreted?.constraints?.value;

  const text = [
    ...toArray(goals),
    ...toArray(constraints)
  ]
    .join(' ')
    .toLowerCase();

  if (
    text.includes('impact') ||
    text.includes('outcome') ||
    text.includes('behaviour') ||
    text.includes('behavior') ||
    text.includes('long-term') ||
    text.includes('long term')
  ) {
    return 'deep';
  }

  if (
    text.includes('performance') ||
    text.includes('competency') ||
    text.includes('capability') ||
    text.includes('skill')
  ) {
    return 'moderate';
  }

  return 'basic';
};

const inferAudienceComplexity = (opportunity) => {
  const audience = opportunity?.interpreted?.audience?.value;
  const text = toText(audience).toLowerCase();

  if (
    text.includes('multiple') ||
    text.includes('diverse') ||
    text.includes('senior') ||
    text.includes('executive') ||
    text.includes('mixed')
  ) {
    return 'high';
  }

  if (
    text.includes('professional') ||
    text.includes('manager') ||
    text.includes('experienced')
  ) {
    return 'moderate';
  }

  return 'basic';
};


const inferLearningIntensity = (opportunity) => {
  const duration = parseDurationDays(opportunity);

  if (duration <= 2) {
    return 'high';
  }

  if (duration <= 5) {
    return 'moderate';
  }

  return 'low';
};


const inferDesignParameters = (opportunity) => {
  if (!opportunity) {
    throw new Error(
      'Opportunity is required to infer architecture parameters'
    );
  }

  const durationDays = parseDurationDays(opportunity);
  const format = parseFormat(opportunity);
  const template = inferTemplate(opportunity);
  const reinforcement = inferReinforcement(opportunity);
  const measurementDepth = inferMeasurementDepth(opportunity);
  const audienceComplexity = inferAudienceComplexity(opportunity);
  const learningIntensity = inferLearningIntensity(opportunity);

  return {
    total_duration_days: durationDays,
    format,
    template,
    reinforcement,
    measurement_depth: measurementDepth,
    audience_complexity: audienceComplexity,
    learning_intensity: learningIntensity,

    audience_level: 'Mid',

    modality_mix: {
      sync_in_person: 40,
      sync_virtual: 20,
      async_self_paced: 20,
      async_social: 20
    },

    channel_mix: {
      lecture: 20,
      case: 20,
      simulation: 15,
      action_learning: 20,
      coaching: 10,
      peer_learning: 10,
      reflection: 5
    }
  };
};


const computeDerivedMetrics = (
  architectureResult,
  opportunity,
  designParameters
) => {
  const phases = Array.isArray(architectureResult?.phases)
    ? architectureResult.phases
    : [];

  const opportunityModules = Array.isArray(opportunity?.modules)
    ? opportunity.modules
    : [];

  const acceptedCompetencies = Array.isArray(opportunity?.competencies)
    ? opportunity.competencies
        .filter((c) => c?.decision !== 'rejected')
        .map((c) => c?.competency_id)
        .filter(Boolean)
    : [];

  const scheduledModuleTitles = new Set(
    phases
      .flatMap((p) =>
        Array.isArray(p?.blocks) ? p.blocks : []
      )
      .flatMap((b) =>
        Array.isArray(b?.modules) ? b.modules : []
      )
  );

  const scheduledModules = opportunityModules.filter(
    (m) => scheduledModuleTitles.has(m?.title)
  );

  const coveredByModules = new Set(
    scheduledModules.flatMap((m) =>
      Array.isArray(m?.competencies_covered)
        ? m.competencies_covered
        : []
    )
  );

  const missing = acceptedCompetencies.filter(
    (id) => !coveredByModules.has(id)
  );

  const covered =
    acceptedCompetencies.length - missing.length;


  const facultyHours = {};
  let totalHours = 0;

  phases.forEach((phase) => {
    const blocks = Array.isArray(phase?.blocks)
      ? phase.blocks
      : [];

    blocks.forEach((block) => {
      const hrs = Number(block?.duration_hrs) || 0;

      totalHours += hrs;

      if (block?.faculty) {
        facultyHours[block.faculty] =
          (facultyHours[block.faculty] || 0) + hrs;
      }
    });
  });

  const facultyUtilisation = Object.entries(
    facultyHours
  ).map(([name, hours]) => ({
    name,
    hours,
    pct: totalHours
      ? Math.round((hours / totalHours) * 100)
      : 0
  }));


  const modalityHours = {
    sync_in_person: 0,
    sync_virtual: 0,
    async_self_paced: 0,
    async_social: 0
  };

  const channelHours = {
    lecture: 0,
    case: 0,
    simulation: 0,
    action_learning: 0,
    coaching: 0,
    peer_learning: 0,
    reflection: 0
  };

  const competencyHours = {};

  phases.forEach((phase) => {
    const blocks = Array.isArray(phase?.blocks)
      ? phase.blocks
      : [];

    blocks.forEach((block) => {
      const hrs = Number(block?.duration_hrs) || 0;

      if (
        block?.modality &&
        Object.prototype.hasOwnProperty.call(
          modalityHours,
          block.modality
        )
      ) {
        modalityHours[block.modality] += hrs;
      }

      if (
        block?.channel &&
        Object.prototype.hasOwnProperty.call(
          channelHours,
          block.channel
        )
      ) {
        channelHours[block.channel] += hrs;
      }

      const blockModules = (
        Array.isArray(block?.modules)
          ? block.modules
          : []
      )
        .map((title) =>
          scheduledModules.find(
            (m) => m?.title === title
          )
        )
        .filter(Boolean);

      if (blockModules.length) {
        const hrsPerModule =
          hrs / blockModules.length;

        blockModules.forEach((module) => {
          const competencies = Array.isArray(
            module?.competencies_covered
          )
            ? module.competencies_covered
            : [];

          competencies.forEach((cid) => {
            competencyHours[cid] =
              (competencyHours[cid] || 0) +
              hrsPerModule;
          });
        });
      }
    });
  });

  const toPct = (hoursMap) =>
    Object.fromEntries(
      Object.entries(hoursMap).map(([key, value]) => [
        key,
        totalHours
          ? Math.round((value / totalHours) * 100)
          : 0
      ])
    );

  const modalityActualMix = toPct(modalityHours);
  const channelActualMix = toPct(channelHours);


  const seventyTwentyTen = {
    formal: channelActualMix.lecture || 0,

    social:
      (channelActualMix.coaching || 0) +
      (channelActualMix.peer_learning || 0),

    experiential:
      (channelActualMix.case || 0) +
      (channelActualMix.simulation || 0) +
      (channelActualMix.action_learning || 0) +
      (channelActualMix.reflection || 0)
  };

  const audienceLevel =
    designParameters?.audience_level || 'Mid';

  const dayHourCeiling =
    CONTACT_HOUR_CEILING[audienceLevel] || 7;

  const warnings = [];

  phases.forEach((phase) => {
    const blocks = Array.isArray(phase?.blocks)
      ? phase.blocks
      : [];

    const phaseHours = blocks.reduce(
      (sum, block) =>
        sum + (Number(block?.duration_hrs) || 0),
      0
    );

    if (phaseHours > dayHourCeiling) {
      warnings.push(
        `${phase?.phase || 'Phase'} is scheduled for ${phaseHours}h, above the ${dayHourCeiling}h/day guideline for a ${audienceLevel} audience`
      );
    }
  });


  const overFocused = Object.entries(
    competencyHours
  )
    .filter(
      ([, hrs]) =>
        totalHours > 0 &&
        hrs / totalHours > 0.4
    )
    .map(([cid]) => cid);

  if (overFocused.length > 0) {
    warnings.push(
      `Competenc${
        overFocused.length === 1 ? 'y' : 'ies'
      } ${overFocused.join(', ')} account${
        overFocused.length === 1 ? 's' : ''
      } for over 40% of programme minutes`
    );
  }


  if (
    ['Senior', 'Top'].includes(audienceLevel) &&
    channelActualMix.lecture > 25
  ) {
    warnings.push(
      `Lecture is ${channelActualMix.lecture}% of programme time for a ${audienceLevel} audience, above the 25% guideline from the 70-20-10 framework`
    );
  }

  const modalityTarget =
    designParameters?.modality_mix || {};

  Object.keys(modalityHours).forEach(
    (channel) => {
      const target =
        Number(modalityTarget[channel]) || 0;

      const actual =
        modalityActualMix[channel] || 0;

      if (Math.abs(actual - target) > 10) {
        warnings.push(
          `Modality "${channel.replace(
            /_/g,
            ' '
          )}" is placed at ${actual}% vs a ${target}% target, more than 10 points off`
        );
      }
    }
  );


  if (missing.length > 0) {
    warnings.push(
      `${missing.length} accepted competenc${
        missing.length === 1
          ? 'y is'
          : 'ies are'
      } not covered by any module: ${missing.join(', ')}`
    );
  }

  facultyUtilisation
    .filter((f) => f.pct > 35)
    .forEach((f) => {
      warnings.push(
        `${f.name} carries ${f.pct}% of total contact hours, above the 35% guideline`
      );
    });

  const durationDays =
    Number(
      architectureResult?.total_days
    ) ||
    Number(
      designParameters?.total_duration_days
    ) ||
    0;

  const hasCapstone = phases.some(
    (phase) =>
      /capstone/i.test(
        phase?.phase || ''
      ) ||
      (Array.isArray(phase?.blocks)
        ? phase.blocks.some((block) =>
            /capstone/i.test(
              block?.title || ''
            )
          )
        : false)
  );

  if (
    durationDays >= 3 &&
    ['medium', 'heavy'].includes(
      designParameters?.reinforcement
    ) &&
    !hasCapstone
  ) {
    warnings.push(
      'Programme is 3+ days with medium/heavy reinforcement but has no capstone element'
    );
  }


  return {
    competency_coverage: {
      covered,
      total: acceptedCompetencies.length,
      missing
    },

    faculty_utilisation: facultyUtilisation,

    modality_actual_mix: modalityActualMix,

    channel_actual_mix: channelActualMix,

    seventy_twenty_ten: seventyTwentyTen,

    competency_hours: competencyHours,

    warnings
  };
};
module.exports = {
  parseDurationDays,
  parseFormat,
  inferTemplate,
  inferReinforcement,
  inferMeasurementDepth,
  inferAudienceComplexity,
  inferLearningIntensity,
  inferDesignParameters,
  computeDerivedMetrics
};