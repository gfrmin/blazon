// ─────────────────────────────────────────────────────────────────────────
// computeWarn() — deterministic, client-side heraldic validation (spec §6.2).
//
// Recursively walks a Coat AST and returns ONE plain-English warning (string) or
// null. Checks: the tincture rule (metal-on-metal / colour-on-colour) with FURS
// neutral and 'proper' exempt; charges-on-ordinaries judged against the ordinary
// they sit on (the fimbriation/tertiary case); and attitude validity (a fish
// can't be rampant). Non-blocking in the UI — a warning, never a hard stop.
// ─────────────────────────────────────────────────────────────────────────

import { contrastClass } from './tinctures.js';
import { attitudeValid, defaultAttitudeFor, validAttitudesFor, ATTITUDES, chargeNoun } from './charges.js';
import { DIVISIONS } from './field.js';
import { normalize } from './achievement.js';

const isOrdinaryLike = (obj) => obj && (obj.kind === 'ordinary' || obj.kind === 'subordinary');

// The contrast class a field presents to charges upon it: 'metal' | 'colour' | null.
// A divided field is neutral unless both parts share a class (then a charge clashes
// with at least one part either way, so we can warn).
function fieldClass(field) {
  if (!field) return null;
  if (field.division) {
    const classes = (field.division.tinctures || []).map(contrastClass);
    const known = classes.filter(Boolean);
    if (known.length && known.every((c) => c === known[0])) return known[0];
    return null;
  }
  return contrastClass(field.tincture);
}

function ruleMessage(cls, kind) {
  const label = cls === 'metal' ? 'Metal on metal' : 'Colour on colour';
  if (kind === 'structure') {
    const fix = cls === 'metal' ? 'a colour' : 'a metal (Or or Argent)';
    return `${label} — heralds have frowned on this for 800 years. Try ${fix} for the structure so it reads with contrast.`;
  }
  return `${label} — the symbol barely shows against the field. Try the opposite class for it.`;
}

function attitudeMessage(g) {
  const noun = chargeNoun(g.object.key);
  const valid = validAttitudesFor(g.object.key);
  const suggestion = defaultAttitudeFor(g.object.key) || valid[0];
  const gloss = suggestion && ATTITUDES[suggestion] ? ` (${ATTITUDES[suggestion].plain})` : '';
  if (!valid.length) {
    return `A ${noun} isn't drawn in a posture — drop the “${g.object.attitude}”.`;
  }
  return `A ${noun} can't be ${g.object.attitude}${suggestion ? ` — try ${suggestion}${gloss}` : ''}.`;
}

function warnCoat(coat) {
  if (coat.marshalling) {
    for (const p of coat.marshalling.parts || []) {
      const w = warnCoat(p);
      if (w) return w;
    }
    return null;
  }
  const fc = fieldClass(coat.field);
  const charges = coat.charges || [];

  for (const g of charges) {
    // Attitude validity (a fish can't be rampant).
    if (g.object?.kind === 'charge' && g.object.attitude && !attitudeValid(g.object.key, g.object.attitude)) {
      return attitudeMessage(g);
    }
    // Tincture rule. Tertiary charges are judged against the charge they sit on.
    const gc = contrastClass(g.tincture);
    if (!gc) continue; // fur/proper charge → neutral
    if (g.role === 'tertiary' && g.on != null && charges[g.on]) {
      const parentClass = contrastClass(charges[g.on].tincture);
      if (parentClass && parentClass === gc) return ruleMessage(gc, 'symbol');
      continue;
    }
    if (fc && fc === gc) {
      return ruleMessage(gc, isOrdinaryLike(g.object) ? 'structure' : 'symbol');
    }
  }
  return null;
}

// Attitude validity for a single achievement charge group (crest, or one side
// of a supporter pair). Deliberately does NOT run the tincture rule: the crest
// sits on a torse (not the field) and supporters stand outside the field
// entirely, so "clashes with the field" isn't a heraldic concept for them —
// only their posture (attitude) can still be wrong for the chosen charge.
function warnAchievementGroup(g) {
  if (g?.object?.kind === 'charge' && g.object.attitude && !attitudeValid(g.object.key, g.object.attitude)) {
    return attitudeMessage(g);
  }
  return null;
}

function warnAchievement(a) {
  if (!a) return null;
  const crestWarn = warnAchievementGroup(a.crest);
  if (crestWarn) return crestWarn;
  if (a.supporters) {
    const dexterWarn = warnAchievementGroup(a.supporters.dexter);
    if (dexterWarn) return dexterWarn;
    const sinisterWarn = warnAchievementGroup(a.supporters.sinister);
    if (sinisterWarn) return sinisterWarn;
  }
  return null;
}

const MOTTO_MAX = 30;
function warnMotto(motto) {
  if (!motto || motto.length <= MOTTO_MAX) return null;
  return `That motto runs ${motto.length} characters — mottoes longer than ${MOTTO_MAX} get cramped on the scroll. Trim it down.`;
}

/**
 * @param {import('./types.js').Coat|object} d  A Coat AST or the legacy flat object.
 * @returns {string|null}
 */
export function computeWarn(d) {
  const coat = normalize(d);
  if (!coat) return null;
  return warnCoat(coat) || warnAchievement(coat.achievement) || warnMotto(coat.motto);
}

export { fieldClass };

// ─────────────────────────────────────────────────────────────────────────
// validateDesignShape() — a HARD structural check (distinct from computeWarn's
// soft heraldic advice). The generation endpoint runs model output through this
// before returning it, so a malformed tool reply (e.g. one truncated at
// max_tokens) is rejected cleanly rather than flowing on into resolveCharges /
// the renderer as a half-formed design.
// ─────────────────────────────────────────────────────────────────────────
const isPlainObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * @param {object} d  a design object (Coat shape) to structurally validate.
 * @returns {string|null}  an error code when malformed, or null when the shape is sound.
 */
export function validateDesignShape(d) {
  if (!isPlainObj(d)) return 'not_an_object';
  if (d.marshalling !== undefined) {
    if (!isPlainObj(d.marshalling) || !Array.isArray(d.marshalling.parts)) return 'invalid_marshalling';
    return null; // marshalled coats are constructed server-side, not by the model
  }
  const f = d.field;
  if (!isPlainObj(f)) return 'missing_field';
  if (typeof f.tincture !== 'string' && !isPlainObj(f.division)) return 'invalid_field';
  if (f.division && (typeof f.division.type !== 'string' || !Array.isArray(f.division.tinctures))) {
    return 'invalid_division';
  }
  if (!Array.isArray(d.charges)) return 'missing_charges';
  for (const g of d.charges) {
    if (!isPlainObj(g) || !isPlainObj(g.object)) return 'invalid_charge';
    if (typeof g.object.key !== 'string' || !g.object.key) return 'invalid_charge_key';
  }
  return null;
}
