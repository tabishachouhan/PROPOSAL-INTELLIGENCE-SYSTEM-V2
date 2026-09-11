// ── AGENT 7 (helper): APPROACH NOTE → POWERPOINT EXPORTER ────────────────
// Turns one opportunity's approach note + modules + architecture + score
// into a polished, "classic" corporate-style .pptx buffer.
// Every deck is different because it is built live from THAT opportunity's
// own data — nothing here is hard-coded per client.

const pptxgen = require('pptxgenjs');

// ---- CLASSIC CORPORATE COLOUR PALETTE -----------------------------------
// Deep navy + warm gold + ivory. Swap these 5 lines if you want a
// different "classic" palette (e.g. maroon/gold, forest/cream, etc.)
const COLORS = {
  navy: '15294F',      // primary dark background
  navyLight: '1E3A6D',
  gold: 'C9A227',      // accent
  ivory: 'F6F3EA',     // light content background
  ink: '1F2430',       // body text on light background
  slate: '5B6472',     // secondary/muted text
  white: 'FFFFFF'
};

const FONT = 'Georgia'; // a classic serif reads as "proposal", not "startup deck"

const SECTION_LABELS = {
  context_and_challenge: 'Context & Challenge',
  programme_philosophy: 'Programme Philosophy',
  learning_journey: 'Learning Journey',
  faculty_bench: 'Faculty Bench',
  evaluation_approach: 'Evaluation Approach',
  analogous_engagements: 'Analogous Engagements',
  commercial_terms: 'Commercial Terms'
};

const SECTION_ORDER = [
  'context_and_challenge',
  'programme_philosophy',
  'learning_journey',
  'faculty_bench',
  'evaluation_approach',
  'analogous_engagements',
  'commercial_terms'
];

// ---- helpers --------------------------------------------------------------

// Break a long paragraph into slide-sized chunks on sentence boundaries
// so no slide is ever a wall of text.
function chunkText(text, maxChars = 620) {
  if (!text) return [];
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/);

  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > maxChars && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = (current + ' ' + sentence).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

function addFooter(slide, pageLabel, clientName) {
  slide.addText(clientName || 'Proposal', {
    x: 0.4, y: 7.05, w: 6, h: 0.3,
    fontFace: FONT, fontSize: 9, color: COLORS.slate
  });
  slide.addText(pageLabel || '', {
    x: 8.7, y: 7.05, w: 1.0, h: 0.3,
    fontFace: FONT, fontSize: 9, color: COLORS.slate, align: 'right'
  });
}

function addSectionHeader(slide, title) {
  // navy header bar with gold underline — the "classic" signature look
  slide.addShape('rect', { x: 0, y: 0, w: 10, h: 1.15, fill: { color: COLORS.navy } });
  slide.addShape('rect', { x: 0, y: 1.15, w: 10, h: 0.05, fill: { color: COLORS.gold } });
  slide.addText(title, {
    x: 0.5, y: 0.18, w: 9, h: 0.8,
    fontFace: FONT, fontSize: 28, bold: true, color: COLORS.white
  });
}

// ---- main export ------------------------------------------------------

async function buildApproachNotePpt(opportunity) {
  const pres = new pptxgen();
  pres.defineLayout({ name: 'PIS_16x9', width: 10, height: 7.5 });
  pres.layout = 'PIS_16x9';

  const clientName = opportunity.client_name || 'Client';
  const programmeName = opportunity.architecture?.design_parameters?.template
    || opportunity.architecture?.programme_name
    || 'Custom Executive Programme';
  const totalDays = opportunity.architecture?.design_parameters?.total_duration_days
    || opportunity.logistics?.total_days
    || opportunity.architecture?.total_days
    || null;
  const sections = opportunity.approach_note?.sections || {};

  // ---------------- SLIDE 1 — TITLE ----------------
  {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.navy };
    slide.addShape('rect', { x: 0, y: 6.55, w: 10, h: 0.06, fill: { color: COLORS.gold } });

    slide.addText('EXECUTIVE EDUCATION PROPOSAL', {
      x: 0.7, y: 1.9, w: 8.6, h: 0.5,
      fontFace: FONT, fontSize: 14, color: COLORS.gold, charSpacing: 3, bold: true
    });
    slide.addText(clientName, {
      x: 0.7, y: 2.45, w: 8.6, h: 1.3,
      fontFace: FONT, fontSize: 40, bold: true, color: COLORS.white
    });
    slide.addText(programmeName, {
      x: 0.7, y: 3.65, w: 8.6, h: 0.6,
      fontFace: FONT, fontSize: 20, italic: true, color: COLORS.ivory
    });
    if (totalDays) {
      slide.addText(`${totalDays} Day Programme`, {
        x: 0.7, y: 4.25, w: 8.6, h: 0.4,
        fontFace: FONT, fontSize: 14, color: COLORS.gold
      });
    }
    slide.addText(
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      { x: 0.7, y: 6.7, w: 6, h: 0.4, fontFace: FONT, fontSize: 11, color: COLORS.ivory }
    );
  }

  // ---------------- SLIDE 2 — AGENDA ----------------
  {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.ivory };
    addSectionHeader(slide, 'Contents');

    const items = SECTION_ORDER
      .filter(k => sections[k])
      .map(k => SECTION_LABELS[k]);
    items.push('Programme Modules');
    if (opportunity.score?.total_score !== undefined) items.push('Proposal Scorecard');

    let y = 1.6;
    items.forEach((label, i) => {
      slide.addText(`${String(i + 1).padStart(2, '0')}`, {
        x: 0.7, y, w: 0.6, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: COLORS.gold
      });
      slide.addText(label, {
        x: 1.4, y, w: 7.5, h: 0.5, fontFace: FONT, fontSize: 16, color: COLORS.ink
      });
      y += 0.62;
    });

    addFooter(slide, '2', clientName);
  }

  // ---------------- CONTENT SECTION SLIDES ----------------
  let pageNum = 3;
  for (const key of SECTION_ORDER) {
    const text = sections[key];
    if (!text) continue;

    const chunks = chunkText(text, 620);
    chunks.forEach((chunk, idx) => {
      const slide = pres.addSlide();
      slide.background = { color: COLORS.ivory };
      const title = chunks.length > 1
        ? `${SECTION_LABELS[key]} (${idx + 1}/${chunks.length})`
        : SECTION_LABELS[key];
      addSectionHeader(slide, title);

      slide.addShape('rect', { x: 0.5, y: 1.55, w: 0.06, h: 5.1, fill: { color: COLORS.gold } });
      slide.addText(chunk, {
        x: 0.85, y: 1.6, w: 8.4, h: 5.0,
        fontFace: FONT, fontSize: 15, color: COLORS.ink, lineSpacing: 24, valign: 'top'
      });

      addFooter(slide, String(pageNum), clientName);
      pageNum++;
    });
  }

  // ---------------- MODULES TABLE SLIDE ----------------
  if (opportunity.modules?.length) {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.ivory };
    addSectionHeader(slide, 'Programme Modules');

    const rows = [
      [
        { text: 'Module', options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy } } },
        { text: 'Domain', options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy } } },
        { text: 'Hrs', options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy } } },
        { text: 'Faculty', options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy } } }
      ]
    ];

    opportunity.modules.slice(0, 9).forEach((m, i) => {
      const shade = i % 2 === 0 ? COLORS.white : 'ECE7D8';
      rows.push([
        { text: m.title || '-', options: { fill: { color: shade } } },
        { text: m.domain || '-', options: { fill: { color: shade } } },
        { text: String(m.duration_hrs ?? '-'), options: { fill: { color: shade } } },
        { text: m.faculty || '-', options: { fill: { color: shade } } }
      ]);
    });

    slide.addTable(rows, {
      x: 0.5, y: 1.55, w: 9.0, h: 5.0,
      fontFace: FONT, fontSize: 12, color: COLORS.ink,
      border: { type: 'solid', color: 'D8D2BF', pt: 0.5 },
      autoPage: false,
      colW: [3.4, 2.0, 0.9, 2.7]
    });

    addFooter(slide, String(pageNum), clientName);
    pageNum++;
  }

  // ---------------- SCORE SLIDE ----------------
  if (opportunity.score?.total_score !== undefined) {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.ivory };
    addSectionHeader(slide, 'Proposal Scorecard');

    slide.addText(`${opportunity.score.total_score}`, {
      x: 0.6, y: 1.7, w: 2.4, h: 1.3,
      fontFace: FONT, fontSize: 54, bold: true, color: COLORS.navy
    });
    slide.addText('/ 100', {
      x: 0.6, y: 2.85, w: 2.4, h: 0.4,
      fontFace: FONT, fontSize: 14, color: COLORS.slate
    });

    const breakdown = opportunity.score.breakdown || {};
    let y = 1.7;
    Object.entries(breakdown).forEach(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      slide.addText(`${label}: ${v.score}/${v.max}`, {
        x: 3.3, y, w: 6.2, h: 0.4,
        fontFace: FONT, fontSize: 13, color: COLORS.ink
      });
      y += 0.42;
    });

    addFooter(slide, String(pageNum), clientName);
    pageNum++;
  }

  // ---------------- CLOSING SLIDE ----------------
  {
    const slide = pres.addSlide();
    slide.background = { color: COLORS.navy };
    slide.addShape('rect', { x: 0, y: 3.55, w: 10, h: 0.05, fill: { color: COLORS.gold } });
    slide.addText('Thank You', {
      x: 0.7, y: 2.7, w: 8.6, h: 0.8,
      fontFace: FONT, fontSize: 36, bold: true, color: COLORS.white
    });
    slide.addText(`We look forward to partnering with ${clientName}.`, {
      x: 0.7, y: 3.75, w: 8.6, h: 0.6,
      fontFace: FONT, fontSize: 16, italic: true, color: COLORS.ivory
    });
  }

  return pres.write({ outputType: 'nodebuffer' });
}

module.exports = { buildApproachNotePpt };