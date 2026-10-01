// ── APPROACH NOTE → POWERPOINT EXPORTER ──────────────────────────────────
// Builds the client-facing Approach Note deck from ONE opportunity's own data.
//
// Deck structure (follows the reference approach note, slides 1–22 only):
//   1. Cover
//   2. Contents
//   3. Programme Context
//   4. Participant Profile
//   5. Key Capability Areas (theme → modules table, split across slides)
//   6. Proposed Learning Journey (phase bands, delivery mode, ALP markers)
//   7. "Recommended Module Details" divider
//   8. One slide per module: description paragraph + 5 bullet points
//
// Everything comes from the opportunity document (brief, interpretation,
// competencies, modules, architecture, approach note). A different client
// gets a different deck in the same design. No logos for now.

const pptxgen = require('pptxgenjs');

let MODULE_CATALOGUE = [];
try { MODULE_CATALOGUE = require('../data/modules'); } catch (e) { /* optional */ }

// ---- COLOURS / FONT / PAGE ------------------------------------------------
const COLORS = {
  navy: '15294F',
  navyLight: '1E3A6D',
  gold: 'C9A227',
  ivory: 'F6F3EA',
  paper: 'FFFFFF',
  ink: '1F2430',
  slate: '5B6472',
  border: 'DCE1EA',
  white: 'FFFFFF'
};
const FONT = 'Calibri';
const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN = 0.6;

// Delivery modes shown on the learning-journey cards
const MODALITY = {
  sync_in_person:   { label: 'In-person',   color: '15294F' },
  sync_virtual:     { label: 'Virtual live', color: '2A7F9E' },
  async_self_paced: { label: 'Self-paced',  color: '5B6472' },
  async_social:     { label: 'Peer / social', color: '8C6D1F' }
};

// ============================================================================
// helpers
// ============================================================================

const asText = v => (Array.isArray(v) ? v.join('; ') : (v == null ? '' : String(v)));

const clip = (s, n) => {
  s = asText(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
};

const titleCase = str => (str || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const fmtHrs = h => (h == null || isNaN(h) ? '' : `${Number(h) % 1 === 0 ? Number(h) : Number(h).toFixed(1)}h`);

function splitParagraphs(text) {
  return asText(text)
    .split(/\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// Group paragraphs into slide-sized chunks; very long paragraphs are split on sentences.
function chunkText(text, maxChars = 900) {
  const paragraphs = [];
  splitParagraphs(text).forEach(p => {
    if (p.length <= maxChars) { paragraphs.push(p); return; }
    let buf = '';
    p.split(/(?<=[.!?])\s+/).forEach(s => {
      if ((buf + ' ' + s).trim().length > maxChars && buf) { paragraphs.push(buf.trim()); buf = s; }
      else buf = (buf + ' ' + s).trim();
    });
    if (buf) paragraphs.push(buf.trim());
  });

  const chunks = [];
  let cur = [];
  let len = 0;
  paragraphs.forEach(p => {
    if (cur.length && len + p.length > maxChars) { chunks.push(cur); cur = []; len = 0; }
    cur.push(p);
    len += p.length;
  });
  if (cur.length) chunks.push(cur);
  return chunks;
}

// Split n items across slides as evenly as possible (no orphan slide)
function evenPages(total, max) {
  const pages = Math.max(1, Math.ceil(total / max));
  return { pages, per: Math.ceil(total / pages) };
}

// ---- shared chrome -------------------------------------------------------
function newSlide(pres, { bg = COLORS.paper } = {}) {
  const slide = pres.addSlide();
  slide.background = { color: bg };
  return slide;
}

function addHeader(slide, title, subtitle) {
  slide.addText(title, {
    x: MARGIN, y: 0.35, w: PAGE_W - MARGIN * 2, h: 0.62,
    fontFace: FONT, fontSize: 26, bold: true, color: COLORS.navy, margin: 0, fit: 'shrink', isTextBox: true
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN, y: 0.95, w: PAGE_W - MARGIN * 2, h: 0.3,
      fontFace: FONT, fontSize: 11, color: COLORS.slate, margin: 0, isTextBox: true
    });
  }
  const ruleY = subtitle ? 1.32 : 1.1;
  slide.addShape('rect', { x: 0, y: ruleY, w: PAGE_W, h: 0.018, fill: { color: COLORS.border } });
  slide.addShape('rect', { x: 0, y: ruleY, w: 1.1, h: 0.018, fill: { color: COLORS.gold } });
  return ruleY + 0.3;
}

function addFooter(slide, pageLabel, footerLeft) {
  if (footerLeft) {
    slide.addText(clip(footerLeft, 60), {
      x: MARGIN, y: PAGE_H - 0.42, w: 8, h: 0.3,
      fontFace: FONT, fontSize: 9, color: COLORS.slate, margin: 0, isTextBox: true
    });
  }
  slide.addText(String(pageLabel || ''), {
    x: PAGE_W - 1.1, y: PAGE_H - 0.42, w: 0.5, h: 0.3,
    fontFace: FONT, fontSize: 9, color: COLORS.slate, align: 'right', margin: 0, isTextBox: true
  });
}

function bulletRuns(items, spaceAfter = 10) {
  return items.map((t, i) => ({
    text: t,
    options: { bullet: { code: '2022' }, breakLine: i < items.length - 1, paraSpaceAfter: spaceAfter }
  }));
}

// ============================================================================
// data adapters
// ============================================================================

const val = f => (f && typeof f === 'object' && !Array.isArray(f) && 'value' in f ? f.value : f);

// Normalises v2 (structured) and legacy (flat `sections`) approach notes
function normaliseNote(opp) {
  const note = opp.approach_note || {};
  const sec = note.sections || {};
  const phases = Array.isArray(note.learning_journey) && note.learning_journey.length
    ? note.learning_journey
    : (Array.isArray(opp.architecture?.phases) ? opp.architecture.phases : []);
  return {
    context: note.context_and_challenge || sec.context_and_challenge || '',
    mapping: Array.isArray(note.theme_module_mapping) ? note.theme_module_mapping : [],
    journey: phases
  };
}

function catalogueFor(m) {
  return MODULE_CATALOGUE.find(x => x.module_id === m.module_id || x.title === m.title) || {};
}

// ============================================================================
// slide builders
// ============================================================================

// ---- 1. COVER -------------------------------------------------------------
function buildCover(pres, { clientName, programmeName, totalDays, format }) {
  const slide = newSlide(pres);
  const splitX = PAGE_W * 0.42;

  // navy block on the right (placeholder for the campus photo / logos — added later)
  slide.addShape('rect', { x: splitX, y: 0, w: PAGE_W - splitX, h: PAGE_H, fill: { color: COLORS.navy } });
  slide.addShape('rect', { x: splitX, y: PAGE_H - 0.08, w: PAGE_W - splitX, h: 0.08, fill: { color: COLORS.gold } });

  slide.addText('APPROACH NOTE', {
    x: 0.85, y: 1.05, w: splitX - 1.2, h: 0.4,
    fontFace: FONT, fontSize: 13, bold: true, color: COLORS.gold, charSpacing: 3, margin: 0, isTextBox: true
  });
  slide.addText(programmeName, {
    x: 0.85, y: 1.5, w: splitX - 1.2, h: 2.0,
    fontFace: FONT, fontSize: 32, bold: true, color: COLORS.navy, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
  });
  slide.addText(`Prepared for ${clientName}`, {
    x: 0.85, y: 3.65, w: splitX - 1.2, h: 0.5,
    fontFace: FONT, fontSize: 16, italic: true, color: COLORS.slate, margin: 0, isTextBox: true
  });

  const meta = [];
  if (totalDays) meta.push(`${totalDays}-Day Programme`);
  if (format) meta.push(titleCase(format));
  if (meta.length) {
    slide.addText(meta.join('   •   '), {
      x: 0.85, y: 4.3, w: splitX - 1.2, h: 0.4,
      fontFace: FONT, fontSize: 12, bold: true, color: COLORS.navy, margin: 0, isTextBox: true
    });
  }
  slide.addText(
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(),
    { x: 0.85, y: PAGE_H - 0.9, w: splitX - 1.2, h: 0.4, fontFace: FONT, fontSize: 11, color: COLORS.slate, charSpacing: 1, margin: 0, isTextBox: true }
  );
}

// ---- 2. CONTENTS ----------------------------------------------------------
function buildContents(pres, items) {
  const slide = newSlide(pres);
  const panelW = PAGE_W * 0.34;

  slide.addShape('rect', { x: 0, y: 0, w: panelW, h: PAGE_H, fill: { color: COLORS.navy } });
  slide.addText('Contents', {
    x: 0.55, y: PAGE_H * 0.38, w: panelW - 0.9, h: 1.0,
    fontFace: FONT, fontSize: 38, bold: true, color: COLORS.white, margin: 0, isTextBox: true
  });
  slide.addShape('rect', { x: 0.55, y: PAGE_H * 0.38 + 1.05, w: 1.3, h: 0.06, fill: { color: COLORS.gold } });

  const colX = [panelW + 0.5, panelW + (PAGE_W - panelW) / 2 + 0.1];
  const colW = (PAGE_W - panelW) / 2 - 0.9;
  let row = 0;
  items.forEach((label, i) => {
    const col = i % 2;
    if (col === 0 && i > 0) row++;
    const x = colX[col];
    const y = 1.2 + row * 1.2;
    slide.addText(String(i + 1).padStart(2, '0'), {
      x, y, w: 0.6, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: COLORS.gold, margin: 0, isTextBox: true
    });
    slide.addText(label.toUpperCase(), {
      x: x + 0.65, y, w: colW - 0.65, h: 0.85,
      fontFace: FONT, fontSize: 13, bold: true, color: COLORS.navy, valign: 'top', margin: 0, isTextBox: true
    });
  });
}

// ---- 3. PROGRAMME CONTEXT -------------------------------------------------
function buildContextSlides(pres, text, { footerLeft, pageRef }) {
  const chunks = chunkText(text, 950);
  chunks.forEach((paras, idx) => {
    const slide = newSlide(pres);
    const title = chunks.length > 1 ? `Programme Context (${idx + 1}/${chunks.length})` : 'Programme Context';
    const y0 = addHeader(slide, title);
    slide.addShape('rect', { x: MARGIN, y: y0, w: 0.045, h: PAGE_H - y0 - 0.8, fill: { color: COLORS.gold } });
    slide.addText(
      paras.map((p, i) => ({ text: p, options: { breakLine: i < paras.length - 1, paraSpaceAfter: 14 } })),
      {
        x: MARGIN + 0.35, y: y0, w: PAGE_W - MARGIN * 2 - 0.35, h: PAGE_H - y0 - 0.8,
        fontFace: FONT, fontSize: 15, color: COLORS.ink, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
      }
    );
    addFooter(slide, pageRef.n++, footerLeft);
  });
}

// ---- 4. PARTICIPANT PROFILE ----------------------------------------------
function buildProfileSlide(pres, opp, { footerLeft, pageRef }) {
  const interp = opp.interpreted || {};
  const audience = asText(val(interp.audience));
  const goals = (val(interp.goals) || []).filter(Boolean).slice(0, 6);
  const constraints = (val(interp.constraints) || []).filter(Boolean).slice(0, 6);
  if (!audience && !goals.length && !constraints.length) return false;

  const slide = newSlide(pres);
  let y = addHeader(slide, 'Participant Profile');

  if (audience) {
    slide.addText(clip(audience, 420), {
      x: MARGIN, y, w: PAGE_W - MARGIN * 2, h: 1.1,
      fontFace: FONT, fontSize: 15, color: COLORS.ink, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
    });
    y += 1.25;
  }

  const twoCols = goals.length && constraints.length;
  const colW = twoCols ? (PAGE_W - MARGIN * 2 - 0.5) / 2 : PAGE_W - MARGIN * 2;
  const blocks = [
    goals.length && { x: MARGIN, head: 'DEVELOPMENT NEEDS ADDRESSED', items: goals },
    constraints.length && { x: twoCols ? MARGIN + colW + 0.5 : MARGIN, head: 'KEY CONSTRAINTS TO DESIGN AROUND', items: constraints }
  ].filter(Boolean);

  blocks.forEach(b => {
    slide.addText(b.head, {
      x: b.x, y, w: colW, h: 0.35,
      fontFace: FONT, fontSize: 12, bold: true, color: COLORS.gold, charSpacing: 1, margin: 0, isTextBox: true
    });
    slide.addText(bulletRuns(b.items.map(t => clip(t, 140)), 8), {
      x: b.x, y: y + 0.45, w: colW, h: PAGE_H - y - 1.4,
      fontFace: FONT, fontSize: 13.5, color: COLORS.ink, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
    });
  });

  addFooter(slide, pageRef.n++, footerLeft);
  return true;
}

// ---- 5. KEY CAPABILITY AREAS ---------------------------------------------
function buildCapabilitySlides(pres, mapping, { footerLeft, pageRef }) {
  const { pages, per } = evenPages(mapping.length, 4);
  const hdr = t => ({ text: t, options: { bold: true, color: COLORS.white, fill: { color: COLORS.navy }, fontSize: 11 } });

  for (let p = 0; p < pages; p++) {
    const slide = newSlide(pres);
    const y0 = addHeader(slide, pages > 1 ? `Key Capability Areas (${p + 1}/${pages})` : 'Key Capability Areas');
    const rows = [[hdr('THEME'), hdr('DESCRIPTION'), hdr('SUGGESTED MODULES')]];

    mapping.slice(p * per, (p + 1) * per).forEach((r, i) => {
      const fill = { color: i % 2 === 0 ? COLORS.white : COLORS.ivory };
      rows.push([
        { text: clip(r.theme, 80) || '-', options: { fill, bold: true, fontSize: 12.5, color: COLORS.navy, valign: 'top' } },
        { text: clip(r.description, 300) || '-', options: { fill, fontSize: 12, color: COLORS.ink, valign: 'top' } },
        { text: (r.modules || []).map(m => '• ' + clip(m, 60)).join('\n') || '-', options: { fill, fontSize: 11.5, color: COLORS.slate, valign: 'top' } }
      ]);
    });

    slide.addTable(rows, {
      x: MARGIN, y: y0, w: PAGE_W - MARGIN * 2,
      fontFace: FONT, color: COLORS.ink,
      border: { type: 'solid', color: COLORS.border, pt: 0.5 },
      margin: [0.08, 0.12, 0.08, 0.12],
      autoPage: false, valign: 'top',
      colW: [2.7, 5.9, 3.53]
    });
    addFooter(slide, pageRef.n++, footerLeft);
  }
}

// ---- 6. PROPOSED LEARNING JOURNEY ----------------------------------------
function buildJourneySlides(pres, phases, { footerLeft, pageRef, totalDays, format }) {
  const CARD_W = 2.55;
  const CARD_GAP = 0.18;
  const CARDS_PER_ROW = 4;
  const CARD_H = 1.0;
  const bandLeft = 2.55;
  const bandH = phase => {
    const blocks = (phase.blocks || []).length;
    const rows = Math.max(1, Math.ceil(blocks / CARDS_PER_ROW));
    return 0.3 + rows * (CARD_H + 0.12) + 0.1;
  };

  const usable = PAGE_H - 1.75 - 0.7; // below header, above footer
  // pre-count slides for the "(x/y)" label
  let slideCount = 1;
  let run = 0;
  phases.forEach(ph => {
    const h = bandH(ph);
    if (run + h > usable && run > 0) { slideCount++; run = 0; }
    run += h;
  });

  const subtitle = [
    totalDays ? `Duration: ${totalDays} days` : null,
    format ? `Delivery Mode: ${titleCase(format)}` : null
  ].filter(Boolean).join('   |   ');

  let slide = null;
  let y = 0;
  let idx = 0;
  const start = () => {
    idx++;
    slide = newSlide(pres);
    const title = slideCount > 1 ? `Proposed Learning Journey (${idx}/${slideCount})` : 'Proposed Learning Journey';
    y = addHeader(slide, title, subtitle) + 0.05;
  };
  const finish = () => {
    slide.addText('Delivery mode shown on each module   |   ALP = Action Learning Project', {
      x: MARGIN, y: PAGE_H - 0.72, w: 9, h: 0.22, fontFace: FONT, fontSize: 9, italic: true, color: COLORS.slate, margin: 0, isTextBox: true
    });
    addFooter(slide, pageRef.n++, footerLeft);
  };

  start();
  phases.forEach((phase, pIdx) => {
    const h = bandH(phase);
    if (y + h > PAGE_H - 0.75 && y > 2) { finish(); start(); }

    // phase label
    slide.addShape('rect', { x: MARGIN, y, w: bandLeft - MARGIN - 0.15, h: h - 0.1, fill: { color: COLORS.ivory } });
    slide.addText(`PHASE ${pIdx + 1}`, {
      x: MARGIN + 0.12, y: y + 0.1, w: bandLeft - MARGIN - 0.4, h: 0.3,
      fontFace: FONT, fontSize: 11, bold: true, color: COLORS.gold, charSpacing: 1, margin: 0, isTextBox: true
    });
    slide.addText(clip(phase.phase || `Phase ${pIdx + 1}`, 40), {
      x: MARGIN + 0.12, y: y + 0.42, w: bandLeft - MARGIN - 0.4, h: 0.55,
      fontFace: FONT, fontSize: 13, bold: true, color: COLORS.navy, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
    });
    if (phase.duration) {
      slide.addText(clip(phase.duration, 30), {
        x: MARGIN + 0.12, y: y + h - 0.5, w: bandLeft - MARGIN - 0.4, h: 0.3,
        fontFace: FONT, fontSize: 10.5, color: COLORS.slate, margin: 0, isTextBox: true
      });
    }

    // module / block cards
    (phase.blocks || []).forEach((b, bIdx) => {
      const row = Math.floor(bIdx / CARDS_PER_ROW);
      const col = bIdx % CARDS_PER_ROW;
      const cx = bandLeft + col * (CARD_W + CARD_GAP);
      const cy = y + 0.05 + row * (CARD_H + 0.12);
      const mod = MODALITY[b.modality];
      const isALP = b.channel === 'action_learning' || /action[\s_-]?learning|\bALP\b/i.test(`${b.title || ''} ${b.format || ''}`);
      const label = (b.modules && b.modules.length ? b.modules.join(' + ') : b.title) || 'Session';

      slide.addShape('roundRect', {
        x: cx, y: cy, w: CARD_W, h: CARD_H,
        fill: { color: COLORS.white }, line: { color: COLORS.border, width: 0.75 }, rectRadius: 0.06
      });
      slide.addText(clip(label, 70), {
        x: cx + 0.12, y: cy + 0.07, w: CARD_W - 0.75, h: 0.5,
        fontFace: FONT, fontSize: 10.5, bold: true, color: COLORS.navy, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
      });
      if (b.duration_hrs) {
        slide.addText(fmtHrs(b.duration_hrs), {
          x: cx + CARD_W - 0.62, y: cy + 0.07, w: 0.5, h: 0.25,
          fontFace: FONT, fontSize: 9.5, bold: true, color: COLORS.gold, align: 'right', margin: 0, isTextBox: true
        });
      }
      const sub = [b.faculty, b.format ? String(b.format).replace(/_/g, ' ') : null].filter(Boolean).join(' • ');
      if (sub) {
        slide.addText(clip(sub, 50), {
          x: cx + 0.12, y: cy + 0.55, w: CARD_W - 0.24, h: 0.2,
          fontFace: FONT, fontSize: 8.5, color: COLORS.slate, margin: 0, isTextBox: true
        });
      }
      const tags = [];
      if (mod) tags.push({ text: mod.label, options: { color: mod.color, bold: true } });
      if (isALP) tags.push({ text: (mod ? '   ' : '') + 'ALP', options: { color: COLORS.gold, bold: true } });
      if (tags.length) {
        slide.addText(tags, {
          x: cx + 0.12, y: cy + CARD_H - 0.27, w: CARD_W - 0.24, h: 0.2,
          fontFace: FONT, fontSize: 9, margin: 0, isTextBox: true
        });
      }
    });

    y += h;
  });
  finish();
}

// ---- 7. DIVIDER -----------------------------------------------------------
function buildDivider(pres, count, clientName, pageRef) {
  const slide = newSlide(pres, { bg: COLORS.navy });
  slide.addText('Recommended Module Details', {
    x: MARGIN + 0.2, y: PAGE_H / 2 - 0.8, w: PAGE_W - MARGIN * 2, h: 0.95,
    fontFace: FONT, fontSize: 40, bold: true, color: COLORS.white, margin: 0, isTextBox: true
  });
  slide.addShape('rect', { x: MARGIN + 0.2, y: PAGE_H / 2 + 0.25, w: 1.3, h: 0.06, fill: { color: COLORS.gold } });
  slide.addText(`${count} module${count === 1 ? '' : 's'} selected for ${clientName}`, {
    x: MARGIN + 0.2, y: PAGE_H / 2 + 0.5, w: PAGE_W - MARGIN * 2, h: 0.5,
    fontFace: FONT, fontSize: 16, color: 'DCE3F1', margin: 0, isTextBox: true
  });
  pageRef.n++;
}

// ---- 8. ONE SLIDE PER MODULE: description + 5 bullets ---------------------
function buildModuleSlides(pres, opp, note, { footerLeft, pageRef }) {
  const compById = {};
  (opp.competencies || []).forEach(c => { compById[c.competency_id] = c; });

  (opp.modules || []).forEach(m => {
    const cat = catalogueFor(m);
    const slide = newSlide(pres);
    const y0 = addHeader(slide, clip(m.title || 'Module', 70));

    const description = cat.short_description || m.short_description
      || `${m.title} is part of the programme designed for ${opp.client_name || 'the client'}${m.domain ? ` in the area of ${m.domain}` : ''}.`;
    slide.addText(clip(description, 460), {
      x: MARGIN, y: y0, w: PAGE_W - MARGIN * 2, h: 1.3,
      fontFace: FONT, fontSize: 15, color: COLORS.ink, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
    });

    // facts used for the 5 bullets
    const compNames = (m.competencies_covered || [])
      .map(id => compById[id]?.competency_name || null).filter(Boolean).slice(0, 3);
    const theme = (note.mapping || []).find(r => (r.modules || []).includes(m.title));
    let phaseName = null;
    (note.journey || []).forEach(ph => {
      if (!phaseName && (ph.blocks || []).some(b => (b.modules || []).includes(m.title))) phaseName = ph.phase;
    });
    const faculty = m.faculty || cat.lead_faculty;
    const format = m.format || cat.format;

    const candidates = [
      format || m.duration_hrs ? `Delivered as ${[format, m.duration_hrs ? `${fmtHrs(m.duration_hrs)} session` : null].filter(Boolean).join(', ')}` : null,
      faculty ? `Led by ${faculty}` : null,
      compNames.length ? `Builds capability in ${compNames.join(', ')}` : null,
      theme ? `Supports the programme theme: ${clip(theme.theme, 80)}` : null,
      phaseName ? `Scheduled in the programme at: ${clip(phaseName, 60)}` : null,
      m.domain ? `Domain: ${m.domain}` : null,
      cat.audience_level ? `Designed for ${cat.audience_level}-level participants` : null,
      m.evidence ? `Track record: ${m.evidence}` : null
    ].filter(Boolean);
    const bullets = candidates.slice(0, 5);

    const boxY = y0 + 1.45;
    slide.addShape('roundRect', {
      x: MARGIN, y: boxY, w: PAGE_W - MARGIN * 2, h: PAGE_H - boxY - 0.8,
      fill: { color: COLORS.ivory }, rectRadius: 0.08
    });
    slide.addText(bulletRuns(bullets, 12), {
      x: MARGIN + 0.35, y: boxY + 0.25, w: PAGE_W - MARGIN * 2 - 0.7, h: PAGE_H - boxY - 1.3,
      fontFace: FONT, fontSize: 16, color: COLORS.ink, valign: 'top', margin: 0, fit: 'shrink', isTextBox: true
    });

    addFooter(slide, pageRef.n++, footerLeft);
  });
}

// ============================================================================
// main export
// ============================================================================

async function buildApproachNotePpt(opportunity) {
  const pres = new pptxgen();
  pres.defineLayout({ name: 'PIS_16x9', width: PAGE_W, height: PAGE_H });
  pres.layout = 'PIS_16x9';

  const clientName = opportunity.client_name || 'Client';
  pres.title = `${clientName} - Approach Note`;

  const dp = opportunity.architecture?.design_parameters || {};
  const programmeName = opportunity.architecture?.programme_name
    || dp.template
    || 'Executive Development Programme';
  const totalDays = dp.total_duration_days || opportunity.logistics?.total_days || null;
  const format = dp.format || opportunity.logistics?.format?.primary || null;

  const note = normaliseNote(opportunity);
  const modules = opportunity.modules || [];
  const interp = opportunity.interpreted || {};
  const hasProfile = !!(asText(val(interp.audience)) || (val(interp.goals) || []).length || (val(interp.constraints) || []).length);

  // Contents lists only what will actually appear
  const contents = [];
  if (note.context) contents.push('Programme Context');
  if (hasProfile) contents.push('Participant Profile');
  if (note.mapping.length) contents.push('Key Capability Areas');
  if (note.journey.length) contents.push('Proposed Learning Journey');
  if (modules.length) contents.push('Recommended Module Details');

  const pageRef = { n: 3 }; // 1 = cover, 2 = contents
  const ctx = { footerLeft: clientName, pageRef };

  buildCover(pres, { clientName, programmeName, totalDays, format });
  buildContents(pres, contents);

  if (note.context) buildContextSlides(pres, note.context, ctx);
  if (hasProfile) buildProfileSlide(pres, opportunity, ctx);
  if (note.mapping.length) buildCapabilitySlides(pres, note.mapping, ctx);
  if (note.journey.length) buildJourneySlides(pres, note.journey, { ...ctx, totalDays, format });
  if (modules.length) {
    buildDivider(pres, modules.length, clientName, pageRef);
    buildModuleSlides(pres, opportunity, note, ctx);
  }

  return pres.write({ outputType: 'nodebuffer' });
}

module.exports = { buildApproachNotePpt };