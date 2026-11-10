#!/usr/bin/env node
'use strict';

// Dev-OS harness conformance checker (zero dependencies).
//
//   node scripts/check-conformance.js            offline: the default. Verifies that
//                                                everything the CLI generates is backed by a
//                                                recorded fact in .agents/evals/conformance.json,
//                                                and reports how old those facts are.
//   node scripts/check-conformance.js --fetch    CI only: additionally re-reads each recorded
//                                                doc page and reports drift (a page that no
//                                                longer mentions an event name Dev-OS wires, or
//                                                that no longer loads at all).
//
// The CLI (bin/devos.js) never calls this and never fetches anything; this script is the only
// place Dev-OS reaches the network for conformance, and only when asked.
//
// Exit codes: 0 = conforms, 1 = a generated value has no recorded fact behind it (always a
// real problem), 2 = --fetch found drift worth a human look.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, '.agents', 'evals', 'conformance.json');
const CLI = path.join(ROOT, 'bin', 'devos.js');

const problems = [];
const drift = [];

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const fixture = readJson(FIXTURE);
if (!fixture) {
  console.error('[ FAIL ] .agents/evals/conformance.json is missing or not valid JSON');
  process.exit(1);
}
const cli = fs.readFileSync(CLI, 'utf8');
const harnesses = fixture.harnesses || {};

// --- what the CLI actually generates ------------------------------------------------------
// Read from the CLI's own exported objects. An earlier version regexed the source, which
// passed silently whenever the formatting changed; the lists below are the real values the
// generators use.
let devos = null;
try {
  devos = require(CLI);
} catch (e) {
  console.error(`[ FAIL ] could not load bin/devos.js to read its wired events: ${e.message}`);
  process.exit(1);
}
const wired = devos.wiredHookEvents || {};
const ocUsed = devos.openCodePluginHooks || [];

Object.entries(wired).forEach(([harness, events]) => {
  const h = harnesses[harness];
  if (!h) { problems.push(`${harness}: wired in the CLI but absent from the fixture`); return; }
  if (!events.length) { problems.push(`${harness}: the CLI exports no wired events`); return; }
  events.forEach((e) => {
    if (!(h.hookEvents || []).includes(e)) problems.push(`${harness}: wires "${e}", which no recorded fact lists`);
  });
});

if (!ocUsed.length) problems.push('opencode: the generated plugin declares no hooks');
ocUsed.forEach((hook) => {
  if (!((harnesses.opencode || {}).pluginHooks || []).includes(hook)) {
    problems.push(`opencode: plugin uses "${hook}", which no recorded fact lists`);
  }
});

(devos.subagentKeysEmitted || []).forEach((key) => {
  const known = ((harnesses.claude || {}).subagentKeys || []).concat((harnesses.claude || {}).subagentKeysIgnoredForPlugins || []);
  if (!known.includes(key)) problems.push(`claude: generator emits "${key}", which no recorded fact lists`);
});
(devos.subagentKeysDropped || []).forEach((key) => {
  if (!((harnesses.claude || {}).subagentKeysIgnoredForPlugins || []).includes(key)) {
    problems.push(`claude: generator drops "${key}" but no recorded fact says it is ignored for plugin agents`);
  }
});
// Enumerated frontmatter values must be recorded too; isolation: remote shipped once on no
// recorded source, which is exactly what this is for.
const valueChecks = [
  ['agentIsolations', 'subagentIsolationValues'],
  ['agentEfforts', 'subagentEffortValues'],
  ['agentColors', 'subagentColorValues'],
  ['agentMemoryScopes', 'subagentMemoryValues']
];
valueChecks.forEach(([exported, recorded]) => {
  const have = devos[exported] || [];
  const want = (harnesses.claude || {})[recorded];
  if (!Array.isArray(want)) { problems.push(`claude: no recorded fact lists ${recorded}`); return; }
  have.forEach((v) => {
    if (!want.includes(v)) problems.push(`claude: generator accepts ${exported} "${v}", which no recorded fact lists`);
  });
});

// --- how old are the facts -----------------------------------------------------------------
const today = new Date();
const dated = [];
Object.entries(harnesses).forEach(([key, h]) => {
  (h.docs || []).forEach((d) => dated.push({ key, what: d.url, verified: d.verified }));
  (h.facts || []).forEach((fct) => dated.push({ key, what: fct.id, verified: fct.verified }));
});
dated.sort((a, b) => String(a.verified).localeCompare(String(b.verified)));
const ageDays = (iso) => Math.floor((today - new Date(iso + 'T00:00:00Z')) / 86400000);
const limit = Number(fixture.stalenessWarningDays) || 120;
const oldest = dated[0];
const stale = dated.filter((d) => ageDays(d.verified) > limit);

// --- report --------------------------------------------------------------------------------
console.log('Dev-OS harness conformance');
console.log(`  fixture:        .agents/evals/conformance.json (schema ${fixture.schemaVersion}, updated ${fixture.updated})`);
console.log(`  harnesses:      ${Object.keys(harnesses).join(', ')}`);
console.log(`  facts recorded: ${dated.length}`);
if (oldest) console.log(`  oldest verified: ${oldest.verified} (${ageDays(oldest.verified)} days) — ${oldest.key}: ${oldest.what}`);
Object.entries(wired).forEach(([harness, events]) => {
  if (events.length) console.log(`  ${harness}: ${events.length} event(s) wired, all recorded`);
});
if (ocUsed.length) console.log(`  opencode: ${ocUsed.length} plugin hook(s) used, all recorded`);

const suspect = [];
Object.entries(harnesses).forEach(([key, h]) => (h.facts || []).forEach((fct) => {
  if (fct.confidence && /suspect/.test(fct.confidence)) suspect.push(`${key}:${fct.id}`);
}));
if (suspect.length) {
  console.log(`  [ WARN ] ${suspect.length} fact(s) marked suspect (doc-only, never measured): ${suspect.join(', ')}`);
}
if (stale.length) {
  console.log(`  [ WARN ] ${stale.length} fact(s) older than ${limit} days; re-verify before relying on them:`);
  stale.slice(0, 10).forEach((d) => console.log(`             ${d.verified} (${ageDays(d.verified)}d) ${d.key}: ${d.what}`));
}

if (problems.length) {
  console.error(`\n[ FAIL ] ${problems.length} generated value(s) have no recorded fact behind them:`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log('\n[ OK ] every generated hook event, plugin hook and dropped frontmatter key is backed by a recorded fact.');

// --- optional: re-read the docs ------------------------------------------------------------
if (!process.argv.includes('--fetch')) process.exit(0);

(async () => {
  console.log('\nRe-reading the recorded doc pages (--fetch):');
  for (const [key, h] of Object.entries(harnesses)) {
    for (const d of h.docs || []) {
      let text = '';
      try {
        const res = await fetch(d.url, { headers: { 'user-agent': 'dev-os-conformance-check' } });
        if (!res.ok) { drift.push(`${key}: ${d.url} returned HTTP ${res.status}`); continue; }
        text = await res.text();
      } catch (e) {
        drift.push(`${key}: ${d.url} could not be read (${e.message})`);
        continue;
      }
      // Only the page that documents events can be judged on event names. The skills, memory
      // and config pages legitimately never mention them, and checking them anyway produced a
      // guaranteed false alarm on every run.
      const coversEvents = /event|hook/i.test(d.covers || '');
      if (!coversEvents) {
        console.log(`  [ OK ]   ${d.url} (verified ${d.verified}; covers ${d.covers || 'unstated'} — not event-checked)`);
        continue;
      }
      const names = (wired[key] || []).concat(key === 'opencode' ? ocUsed : []);
      const missing = names.filter((n) => !text.includes(n));
      if (missing.length) drift.push(`${key}: ${d.url} no longer mentions ${missing.join(', ')}`);
      console.log(`  ${missing.length ? '[ WARN ]' : '[ OK ]  '} ${d.url} (verified ${d.verified})`);
    }
  }
  if (drift.length) {
    console.error(`\n[ WARN ] ${drift.length} possible drift(s):`);
    drift.forEach((d) => console.error(`  - ${d}`));
    process.exit(2);
  }
  console.log('\n[ OK ] every recorded doc page still names the events Dev-OS wires.');
})();
