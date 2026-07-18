// ─────────────────────────────────────────────────────────────────────────
// blazon() — derive the formal blazon and the plain-English translation from a
// Coat AST. A recursive serializer that honours canonical blazon order
// (field → primary → secondary → tertiary → peripheral), the tincture-elision
// rule (a run of same-tincture charges names the tincture only on the last),
// field divisions, attitudes/lines, and marshalling (quarterly/impaled).
//
// Accepts the legacy flat design object too (via normalize); for a simple coat
// it reproduces the prototype's output, now with conventionally-capitalised
// tinctures ("…Or between three mullets Argent").
// ─────────────────────────────────────────────────────────────────────────

import { tinctureFormal, tincturePlain } from './tinctures.js';
import { DIVISIONS, isRepeatingDivision } from './field.js';
import { ordinaryNoun, ordinaryPlain, isEnclosingSubordinary } from './ordinaries.js';
import { chargeNoun, chargePlain, ATTITUDES } from './charges.js';
import { normalize, HELMETS } from './achievement.js';

const NUM = ['', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const numWord = (n) => NUM[n] || String(n);
const ordWord = (n) => ORD[n] || `${n}th`;
const aOrAn = (word) => (/^[aeiou]/i.test(word || '') ? 'an' : 'a');
const capFirst = (s) => s.replace(/[a-zé]/i, (c) => c.toUpperCase());
const capWord = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const isOrdinaryLike = (obj) => obj && (obj.kind === 'ordinary' || obj.kind === 'subordinary');

// ── Field ────────────────────────────────────────────────────────────────
function fieldFormal(field) {
  if (!field) return '';
  if (field.division) {
    const d = field.division;
    const meta = DIVISIONS[d.type] || {};
    const ts = (d.tinctures || []).map(tinctureFormal).join(' and ');
    if (meta.repeat || isRepeatingDivision(d.type)) {
      const count = d.count ? ` of ${numWord(d.count)}` : '';
      return `${capWord(d.type)}${count} ${ts}`.trim();
    }
    const line = d.line && d.line !== 'straight' ? ` ${d.line}` : '';
    return `${capWord(d.type)}${line} ${ts}`.trim();
  }
  let s = tinctureFormal(field.tincture);
  if (field.treatment) s += ` ${field.treatment.type}${field.treatment.of ? ` of ${field.treatment.of}` : ''}`;
  return s;
}

function fieldPlain(field) {
  if (!field) return 'plain';
  if (field.division) {
    const d = field.division;
    const meta = DIVISIONS[d.type] || {};
    const ts = (d.tinctures || []).map(tincturePlain).join(' and ');
    return `${ts} ${meta.plain || d.type}`.trim();
  }
  return tincturePlain(field.tincture);
}

// ── A charge group ─────────────────────────────────────────────────────────
function objectModifiers(obj) {
  const mods = [];
  if (obj.variant) mods.push(obj.variant);
  if (isOrdinaryLike(obj) && obj.line && obj.line !== 'straight') mods.push(obj.line);
  if (obj.kind === 'ordinary' && obj.cotised) mods.push('cotised');
  if (obj.kind === 'charge' && obj.attitude) mods.push(obj.attitude);
  if (obj.kind === 'charge' && obj.treatment) mods.push(obj.treatment);
  return mods;
}

function objectNounFormal(obj, plural) {
  if (isOrdinaryLike(obj)) return ordinaryNoun(obj.key, { plural, diminutive: obj.diminutive });
  return chargeNoun(obj.key, plural);
}

function groupFormal(g, includeTincture) {
  const n = g.number || 1;
  const plural = n > 1;
  const noun = objectNounFormal(g.object, plural);
  const lead = plural ? numWord(n) : aOrAn(noun);
  let s = `${lead} ${noun}`;
  const mods = objectModifiers(g.object);
  if (mods.length) s += ` ${mods.join(' ')}`;
  if (g.arrangement) s += ` ${g.arrangement}`;
  if (includeTincture && g.tincture) s += ` ${tinctureFormal(g.tincture)}`;
  return s;
}

// Serialize a sequence of groups, applying the tincture-elision rule: within a
// run of identical tinctures the colour is named only on the last group.
function serializeList(groups) {
  return groups
    .map((g, i) => {
      const next = groups[i + 1];
      const include = !next || next.tincture !== g.tincture;
      return groupFormal(g, include);
    })
    .join(', ');
}

function groupPlain(g) {
  const n = g.number || 1;
  const plural = n > 1;
  const obj = g.object;
  // Plain mode is jargon-free: an ordinary reads by its gloss ("horizontal
  // band"), not its heraldic noun ("fess").
  const noun = isOrdinaryLike(obj) ? ordinaryPlain(obj.key) : chargePlain(obj.key, plural);
  // 'proper' ("in natural colours") and a missing tincture are NOT leading
  // colour adjectives — trailing/absent, so we say "a lion in natural colours"
  // and "three stars" rather than "an in natural colours lion" / "a  star".
  const isProper = g.tincture === 'proper';
  const colour = isProper ? '' : tincturePlain(g.tincture);
  const head = colour ? `${colour} ${noun}` : noun;
  const lead = plural ? numWord(n) : aOrAn(head);
  let s = `${lead} ${head}`;
  if (obj.kind === 'charge' && obj.attitude && ATTITUDES[obj.attitude]) {
    s += ` ${ATTITUDES[obj.attitude].plain}`;
  }
  if (isProper) s += ' in natural colours';
  return s;
}

// ── A single coat ──────────────────────────────────────────────────────────
function byRole(charges) {
  const r = { primary: [], secondary: [], tertiary: [], peripheral: [] };
  for (const g of charges || []) (r[g.role] || r.secondary).push(g);
  return r;
}

// Tertiary charges sit ON the primary ordinary ("on the fess, three mullets
// Gules") — referenced by its definite article since the ordinary is already
// named in the main clause. With no ordinary host they degrade to a bare list.
function tertiaryFormal(tertiary, primary) {
  const host = primary[0];
  const list = serializeList(tertiary);
  if (host && isOrdinaryLike(host.object)) {
    return `on the ${objectNounFormal(host.object, false)}, ${list}`;
  }
  return list;
}

const isChiefGroup = (g) => g.object?.key === 'chief';

function coatFormal(coat) {
  if (coat.marshalling) return marshalledFormal(coat.marshalling);
  const field = fieldFormal(coat.field);
  const { primary, secondary, tertiary, peripheral } = byRole(coat.charges);
  if (!primary.length && !secondary.length && !tertiary.length && !peripheral.length) return field;

  const segments = [];
  if (primary.length === 1 && isOrdinaryLike(primary[0].object) && secondary.length) {
    // Elision across "between": when the ordinary shares the following charges'
    // tincture, the colour is named only once, at the end ("a chevron between
    // three mullets Or"), not repeated ("a chevron Or between three mullets Or").
    const includeOrd = primary[0].tincture !== secondary[0].tincture;
    segments.push(`${groupFormal(primary[0], includeOrd)} between ${serializeList(secondary)}`);
  } else {
    segments.push(serializeList(primary.concat(secondary)));
  }
  if (tertiary.length) segments.push(tertiaryFormal(tertiary, primary));

  // Peripheral subordinaries: enclosing ones ("within a bordure Or") hang off
  // the clause with no comma; the rest are apposed, with any chief blazoned last.
  const enclosing = peripheral.filter((g) => isEnclosingSubordinary(g.object?.key));
  const apposed = peripheral
    .filter((g) => !isEnclosingSubordinary(g.object?.key))
    .sort((a, b) => (isChiefGroup(a) ? 1 : 0) - (isChiefGroup(b) ? 1 : 0));

  const commaParts = [...segments.filter(Boolean), ...apposed.map((g) => groupFormal(g, true))];
  if (!commaParts.length) {
    // Nothing but enclosing subordinaries — appose them to the field directly.
    const only = enclosing.map((g) => groupFormal(g, true));
    return only.length ? `${field}, ${only.join(', ')}` : field;
  }
  let out = `${field}, ${commaParts.join(', ')}`;
  for (const g of enclosing) out += ` within ${groupFormal(g, true)}`;
  return out;
}

function coatPlain(coat) {
  if (coat.marshalling) return marshalledPlain(coat.marshalling);
  let s = `A ${fieldPlain(coat.field)} shield`;
  const { primary, secondary, tertiary, peripheral } = byRole(coat.charges);
  const phrases = [...primary, ...secondary, ...tertiary, ...peripheral].map(groupPlain);
  if (phrases.length) {
    s += ` with ${phrases[0]}`;
    for (let i = 1; i < phrases.length; i++) s += `, and ${phrases[i]}`;
  }
  return `${s}.`;
}

// ── Marshalling ──────────────────────────────────────────────────────────
function marshalledFormal(m) {
  const parts = (m.parts || []).map(coatFormal);
  if (!parts.length) return '';
  if (m.type === 'impaled' || m.type === 'impalement') return parts.join(' impaling ');
  if (m.type === 'quarterly') {
    if (parts.length === 2) return `Quarterly, 1 and 4 ${parts[0]}; 2 and 3 ${parts[1]}`;
    return `Quarterly, ${parts.map((p, i) => `${ordWord(i + 1)} ${p}`).join('; ')}`;
  }
  if (DIVISIONS[m.type]) return `${capWord(m.type)}, ${parts.join('; ')}`;
  return parts.join('; ');
}

function marshalledPlain(m) {
  const parts = (m.parts || []).map(coatPlain);
  if (!parts.length) return '';
  if (m.type === 'impaled' || m.type === 'impalement') {
    return `Two coats side by side: ${parts.join(' and ')}`;
  }
  if (m.type === 'quarterly') return `Four quarters: ${parts.join(' and ')}`;
  return parts.join(' and ');
}

// ── Achievement (crest/helm/mantling/supporters/compartment) ──────────────
// Additive: appended AFTER the escutcheon sentence as its own labelled
// clauses (formal) or short sentences (plain). Never touches coatFormal/
// coatPlain, so a coat with no `achievement` member serializes exactly as it
// did before this existed (the regression lock). The motto is deliberately
// never read here — it is not part of a blazon.

// Grant-of-arms convention: dexter/sinister are the BEARER's right/left (the
// standard heraldic meaning of the words themselves), so the formal clause
// uses them unmodified. The plain-English clause instead describes the
// VIEWER's perspective — what a non-herald actually sees facing the shield —
// which is the mirror image: the dexter supporter (bearer's right) is on the
// viewer's LEFT, and the sinister supporter (bearer's left) is on the
// viewer's RIGHT.

function crestFormal(a) {
  if (!a.crest) return null;
  const body = groupFormal(a.crest, true);
  if (a.torse) {
    const [metal, colour] = a.torse.tinctures;
    return `Crest: on a torse ${tinctureFormal(metal)} and ${tinctureFormal(colour)}, ${body}`;
  }
  return `Crest: ${body}`;
}

function helmFormal(a) {
  if (!a.helm) return null;
  const style = a.helm.style || 'esquire';
  if (style === 'esquire') return null; // the default rank is noise, not blazoned
  const h = HELMETS[style];
  return h ? `Helm: ${h.formal}` : null;
}

function mantlingFormal(a) {
  if (!a.mantling) return null;
  const [colour, metal] = a.mantling.tinctures;
  return `Mantling: ${tinctureFormal(colour)} doubled ${tinctureFormal(metal)}`;
}

function supporterFormal(s) {
  return groupFormal({ number: 1, tincture: s.tincture, object: s.object }, true);
}

function supportersFormal(supp) {
  if (supp.sinister) {
    return `Supporters: on the dexter ${supporterFormal(supp.dexter)}, and on the sinister ${supporterFormal(supp.sinister)}`;
  }
  const pair = groupFormal({ number: 2, tincture: supp.dexter.tincture, object: supp.dexter.object }, true);
  return `Supporters: ${pair}`;
}

function compartmentFormal(c) {
  const type = c.type ? `a ${c.type}` : 'a compartment';
  const tincture = c.tincture ? ` ${tinctureFormal(c.tincture)}` : '';
  return `Compartment: ${type}${tincture}`;
}

function achievementFormalClauses(a) {
  if (!a) return [];
  return [
    crestFormal(a),
    helmFormal(a),
    mantlingFormal(a),
    a.supporters ? supportersFormal(a.supporters) : null,
    a.compartment ? compartmentFormal(a.compartment) : null,
  ].filter(Boolean);
}

function crestPlain(a) {
  if (!a.crest) return null;
  const body = groupPlain(a.crest);
  const wreath = a.torse
    ? ` on a twisted wreath of ${tincturePlain(a.torse.tinctures[0])} and ${tincturePlain(a.torse.tinctures[1])}`
    : '';
  return `Above the shield, ${body} stands${wreath}.`;
}

function helmPlain(a) {
  if (!a.helm) return null;
  const style = a.helm.style || 'esquire';
  if (style === 'esquire') return null;
  const h = HELMETS[style];
  if (!h) return null;
  const rank = h.formal.replace(/\s*helmet$/, ''); // "a knight's helmet" → "a knight's"
  return `The helm is ${rank}.`;
}

function mantlingPlain(a) {
  if (!a.mantling) return null;
  const [colour, metal] = a.mantling.tinctures;
  return `The mantling — the cloth behind the shield — is ${tincturePlain(colour)} lined with ${tincturePlain(metal)}.`;
}

function supporterPhrasePlain(s, plural) {
  const colour = tincturePlain(s.tincture);
  const obj = s.object;
  const noun = isOrdinaryLike(obj) ? ordinaryNoun(obj.key, { plural }) : chargePlain(obj.key, plural);
  const lead = plural ? 'two' : aOrAn(colour);
  return `${lead} ${colour} ${noun}`;
}

function supportersPlain(supp) {
  if (supp.sinister) {
    const dexter = supporterPhrasePlain(supp.dexter, false);
    const sinister = supporterPhrasePlain(supp.sinister, false);
    return `${capWord(dexter)} holds the shield on the left, and ${sinister} on the right.`;
  }
  const pair = supporterPhrasePlain(supp.dexter, true);
  return `${capWord(pair)} hold the shield up.`;
}

function compartmentPlain(c) {
  const type = c.type || 'ground';
  const tincture = c.tincture ? ` of ${tincturePlain(c.tincture)}` : '';
  return `The shield stands on a ${type}${tincture}.`;
}

function achievementPlainClauses(a) {
  if (!a) return [];
  return [
    crestPlain(a),
    helmPlain(a),
    mantlingPlain(a),
    a.supporters ? supportersPlain(a.supporters) : null,
    a.compartment ? compartmentPlain(a.compartment) : null,
  ].filter(Boolean);
}

/**
 * Derive the blazon of a design.
 * @param {import('./types.js').Coat|object} d  A Coat AST or the legacy flat object.
 * @param {'formal'|'plain'} lang
 * @returns {string}
 */
export function blazon(d, lang) {
  const coat = normalize(d);
  if (!coat) return '';
  if (lang === 'formal') {
    const escutcheon = coatFormal(coat);
    const clauses = achievementFormalClauses(coat.achievement);
    return capFirst(clauses.length ? `${escutcheon}. ${clauses.join('. ')}.` : escutcheon);
  }
  const escutcheon = coatPlain(coat);
  const clauses = achievementPlainClauses(coat.achievement);
  return clauses.length ? `${escutcheon} ${clauses.join(' ')}` : escutcheon;
}
