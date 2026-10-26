#!/usr/bin/env node
'use strict';

// Dev-OS hook input normalizer (zero dependencies).
//
// Reads a Claude Code hook payload (JSON on stdin) or, in test mode, a raw Bash
// command passed with --command, and prints one KEY=value record per line for
// the shell hooks to consume with `while IFS= read -r line`. Values never contain
// newlines (CR/LF are flattened to " ; "), so the output is safe to read without
// eval.
//
// This is a guard, not a sandbox. It recognises common shell shapes; anything it
// cannot close or parse (or a script fed to a shell on stdin) falls back to a
// conservative regex over the whole command text. The authoritative protections
// live in the scripts themselves (commit.sh, the git pre-commit hook).
//
// Usage:
//   node hook-input.js                     # parse hook JSON from stdin
//   node hook-input.js --command "<cmd>"   # test mode: treat <cmd> as a Bash command
//
// Records (TARGET/UTARGET may repeat or be absent):
//   PARSE=json|raw|empty|partial|error  json = valid hook payload, raw = non-JSON stdin
//                             (treated as a Bash command), empty = no input,
//                             partial = stdin was not fully read before the timeout, or it
//                             looks like JSON but does not parse: the conservative fallback
//                             regex ran over the raw text and TARGET lines come from the
//                             file_path found in it (or, failing that, every path-like string),
//                             error = the helper crashed (callers must fail closed)
//   EVENT=<hook_event_name>
//   TOOL_NAME=<tool_name>     "Bash" in test/raw mode
//   COMMAND=<tool_input.command>
//   FILE_PATH=<tool_input.file_path | notebook_path>
//   STOP_HOOK_ACTIVE=true|false
//   SOURCE=<SessionStart source>
//   ROOT=<project root>       $CLAUDE_PROJECT_DIR, else nearest ancestor of cwd with .agents/
//   GIT_COMMIT=0|1            command creates a commit (commit, commit-tree, merge, cherry-pick,
//                             revert, am, or an alias of one), or drives commit.sh/git through a pty
//   APPROVAL_ENV=0|1          command assigns DEVOS_COMMIT_APPROVED, DEVOS_HEADLESS_COMMIT or
//                             DEVOS_AGENT_COMMIT
//   COMMIT_SH=none|canonical|noncanonical
//                             how the command runs .agents/scripts/commit.sh. canonical: as the
//                             literal command word ".agents/scripts/commit.sh", which the Claude Code
//                             ask rule Bash(.agents/scripts/commit.sh *) matches. noncanonical: any
//                             other spelling (bash/sh/source/./absolute path/expansion/eval/command
//                             substitution), which would skip that prompt; callers block it
//   MARKER_TAMPER=0|1         command unsets/overrides agent-shell markers (or clears the
//                             environment) and also runs git or commit.sh
//   DESTRUCTIVE=<reason>      empty when nothing destructive was found
//   UNSURE=0|1                part of the command could not be parsed; the conservative
//                             fallback regex was applied to the whole command
//   TARGET=<root-relative path written by the tool call> (files outside ROOT are omitted)
//   UTARGET=<raw path>        write target that could not be resolved (unknown variable,
//                             command substitution); callers apply the UI-extension check
//   PROTECTED=<path>          the call writes, moves or deletes Dev-OS gate state
//                             (.git/devos-*, .git/hooks/*), or a Bash command names the
//                             TRIVIAL budget / session stamp files; callers block
//   SESSION_ID=<session_id>   from the payload ([A-Za-z0-9._-] only); keys the TRIVIAL budget
// Edit tool calls only (TRIVIAL fast path in pre-tool-use.sh):
//   EDIT_EXISTS=0|1           tool_input.file_path is an existing regular file
//   EDIT_LINES=<n>            changed lines: max(lines(old_string), lines(new_string)),
//                             multiplied by the occurrence count when replace_all is set
//   EDIT_BYTES=<n>            old_string.length + new_string.length (times occurrences)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STDIN_TIMEOUT_MS = 3000;
const MAX_DEPTH = 8;
const MAX_SQL_FILE_BYTES = 2 * 1024 * 1024;

// Agent-shell markers. Verified sources:
//   CLAUDECODE                 Claude Code (verified by the maintainer)
//   CLAUDE_CODE_ENTRYPOINT     Claude Code (observed in agent shells)
//   GEMINI_CLI                 Gemini CLI docs/tools/shell.md: run_shell_command sets GEMINI_CLI=1
//   CODEX_SANDBOX, CODEX_SANDBOX_NETWORK_DISABLED   openai/codex codex-rs/core/src/spawn.rs
//   CODEX_THREAD_ID            openai/codex codex-rs/core/src/exec_env.rs
//   CURSOR_AGENT               Cursor staff on forum.cursor.com (no official docs page)
//   AI_AGENT                   generic convention (@vercel/detect-agent); set by Claude Code
const AGENT_MARKERS = ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'GEMINI_CLI', 'CODEX_SANDBOX',
  'CODEX_SANDBOX_NETWORK_DISABLED', 'CODEX_THREAD_ID', 'CURSOR_AGENT', 'AI_AGENT'];
const APPROVAL_VARS = ['DEVOS_HEADLESS_COMMIT', 'DEVOS_COMMIT_APPROVED', 'DEVOS_AGENT_COMMIT'];
const COMMIT_SH_CANONICAL = '.agents/scripts/commit.sh';

function flat(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\0/g, '').replace(/\r?\n|\r/g, ' ; ');
}

// ---------------------------------------------------------------------------
// Low-level scanners. Each takes the index just after an opening token and
// returns { end, ok }: end is the index of the closing character, ok=false when
// the construct is never closed (the caller then fails closed).
// ---------------------------------------------------------------------------

const FAIL = (s) => ({ end: s.length, ok: false });

function skipSingle(s, i) {
  const j = s.indexOf('\'', i);
  return j === -1 ? FAIL(s) : { end: j, ok: true };
}

function skipAnsi(s, i) {
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '\'') return { end: j, ok: true };
  }
  return FAIL(s);
}

function skipBacktick(s, i) {
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '`') return { end: j, ok: true };
  }
  return FAIL(s);
}

function skipDouble(s, i) {
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (c === '"') return { end: j, ok: true };
    let r = null;
    if (c === '$' && s[j + 1] === '(') r = s[j + 2] === '(' ? skipArith(s, j + 3) : skipCmdSub(s, j + 2);
    else if (c === '$' && s[j + 1] === '{') r = skipBrace(s, j + 2);
    else if (c === '`') r = skipBacktick(s, j + 1);
    if (r) { if (!r.ok) return r; j = r.end; }
  }
  return FAIL(s);
}

// After "${": matching "}" (nested ${...}, quotes and substitutions honoured).
function skipBrace(s, i) {
  let depth = 1;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    let r = null;
    if (c === '\'') r = skipSingle(s, j + 1);
    else if (c === '"') r = skipDouble(s, j + 1);
    else if (c === '`') r = skipBacktick(s, j + 1);
    else if (c === '$' && s[j + 1] === '(') r = s[j + 2] === '(' ? skipArith(s, j + 3) : skipCmdSub(s, j + 2);
    else if (c === '$' && s[j + 1] === '{') { depth++; j++; continue; }
    else if (c === '}') { depth--; if (depth === 0) return { end: j, ok: true }; }
    if (r) { if (!r.ok) return r; j = r.end; }
  }
  return FAIL(s);
}

// After "$((" or "((": index of the second ")" of the closing "))".
// "<<" in here is a shift, never a heredoc.
function skipArith(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    let r = null;
    if (c === '\'') r = skipSingle(s, j + 1);
    else if (c === '"') r = skipDouble(s, j + 1);
    else if (c === '`') r = skipBacktick(s, j + 1);
    else if (c === '$' && s[j + 1] === '(' && s[j + 2] !== '(') r = skipCmdSub(s, j + 2);
    else if (c === '$' && s[j + 1] === '{') r = skipBrace(s, j + 2);
    else if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) return s[j + 1] === ')' ? { end: j + 1, ok: true } : FAIL(s);
      depth--;
    }
    if (r) { if (!r.ok) return r; j = r.end; }
  }
  return FAIL(s);
}

// Reads a heredoc delimiter word starting at k (after "<<" / "<<-").
function readHeredocWord(s, k) {
  while (k < s.length && (s[k] === ' ' || s[k] === '\t')) k++;
  let delim = '';
  let quoted = false;
  while (k < s.length && !/[\s;&|()<>]/.test(s[k])) {
    const c = s[k];
    if (c === '\'' || c === '"') {
      quoted = true;
      const e = s.indexOf(c, k + 1);
      if (e === -1) return { delim, quoted, end: s.length, ok: false };
      delim += s.slice(k + 1, e);
      k = e + 1;
      continue;
    }
    if (c === '\\') { quoted = true; delim += s[k + 1] || ''; k += 2; continue; }
    delim += c;
    k++;
  }
  return { delim, quoted, end: k, ok: delim.length > 0 };
}

// Consumes heredoc bodies starting at j (start of the line after the operator line).
// Returns { end, ok, bodies }; ok=false if a delimiter line is missing.
function readHeredocBodies(s, j, heredocs) {
  const bodies = [];
  for (const h of heredocs) {
    const lines = [];
    let found = false;
    while (j < s.length) {
      let e = s.indexOf('\n', j);
      if (e === -1) e = s.length;
      const line = s.slice(j, e);
      j = e + 1;
      if ((h.strip ? line.replace(/^\t+/, '') : line) === h.delim) { found = true; break; }
      lines.push(line);
    }
    bodies.push(lines.join('\n'));
    if (!found) return { end: s.length, ok: false, bodies };
  }
  return { end: Math.min(j, s.length), ok: true, bodies };
}

const CMD_START_RE = /(^|[;&|\n(]|(^|[\s;&|(])(then|do|else|elif|if|while|until|!|\{))\s*$/;

// After "$(" (or "<(" / ">("): index of the matching ")". Understands quotes,
// nested substitutions, comments, heredoc bodies, (( )) arithmetic and case patterns.
function skipCmdSub(s, i) {
  let depth = 1;
  const caseStack = [];
  let heredocs = [];
  let wordStart = true;
  let j = i;
  while (j < s.length) {
    const c = s[j];
    if (c === '\n') {
      j++;
      wordStart = true;
      if (heredocs.length) {
        const r = readHeredocBodies(s, j, heredocs);
        if (!r.ok) return FAIL(s);
        j = r.end;
        heredocs = [];
      }
      continue;
    }
    if (c === '\\') { j += 2; wordStart = false; continue; }
    let r = null;
    if (c === '\'') r = skipSingle(s, j + 1);
    else if (c === '"') r = skipDouble(s, j + 1);
    else if (c === '`') r = skipBacktick(s, j + 1);
    else if (c === '$' && s[j + 1] === '\'') r = skipAnsi(s, j + 2);
    else if (c === '$' && s[j + 1] === '"') r = skipDouble(s, j + 2);
    else if (c === '$' && s[j + 1] === '(') r = s[j + 2] === '(' ? skipArith(s, j + 3) : skipCmdSub(s, j + 2);
    else if (c === '$' && s[j + 1] === '{') r = skipBrace(s, j + 2);
    if (r) {
      if (!r.ok) return r;
      j = r.end + 1;
      wordStart = false;
      continue;
    }
    if (c === '#' && wordStart) {
      while (j < s.length && s[j] !== '\n') j++;
      continue;
    }
    if (c === '<' && s[j + 1] === '<' && s[j + 2] === '<') { j += 3; wordStart = true; continue; }
    if (c === '<' && s[j + 1] === '<') {
      let k = j + 2;
      let strip = false;
      if (s[k] === '-') { strip = true; k++; }
      const h = readHeredocWord(s, k);
      if (!h.ok) return FAIL(s);
      heredocs.push({ delim: h.delim, strip });
      j = h.end;
      wordStart = true;
      continue;
    }
    if (c === '(') {
      if (s[j + 1] === '(' && CMD_START_RE.test(s.slice(i, j))) {
        const a = skipArith(s, j + 2);
        if (!a.ok) return a;
        j = a.end + 1;
        continue;
      }
      depth++;
      j++;
      wordStart = true;
      continue;
    }
    if (c === ')') {
      if (caseStack.length && depth === caseStack[caseStack.length - 1]) { j++; wordStart = true; continue; }
      depth--;
      if (depth === 0) return { end: j, ok: true };
      j++;
      wordStart = true;
      continue;
    }
    if (/[\s;&|<>]/.test(c)) { j++; wordStart = true; continue; }
    if (wordStart) {
      const m = /^(case|esac)(?=[\s;&|()]|$)/.exec(s.slice(j, j + 5));
      if (m && m[1] === 'case') caseStack.push(depth);
      else if (m && m[1] === 'esac') caseStack.pop();
    }
    wordStart = false;
    j++;
  }
  return FAIL(s);
}

// Decodes the body of a $'...' string (s[i] is the first char after "$'").
function decodeAnsi(s, i, end) {
  let out = '';
  const simple = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', v: '\v', '\\': '\\', '\'': '\'', '"': '"', '?': '?' };
  for (let j = i; j < end; j++) {
    const c = s[j];
    if (c !== '\\') { out += c; continue; }
    const d = s[j + 1];
    if (d === undefined) break;
    if (simple[d] !== undefined) { out += simple[d]; j++; continue; }
    let m;
    if ((m = /^x([0-9a-fA-F]{1,2})/.exec(s.slice(j + 1, end)))) { out += String.fromCharCode(parseInt(m[1], 16)); j += m[0].length; continue; }
    if ((m = /^u([0-9a-fA-F]{1,4})/.exec(s.slice(j + 1, end)))) { out += String.fromCharCode(parseInt(m[1], 16)); j += m[0].length; continue; }
    if ((m = /^U([0-9a-fA-F]{1,8})/.exec(s.slice(j + 1, end)))) {
      try { out += String.fromCodePoint(parseInt(m[1], 16)); } catch (e) { /* invalid code point */ }
      j += m[0].length;
      continue;
    }
    if ((m = /^[0-7]{1,3}/.exec(s.slice(j + 1, end)))) { out += String.fromCharCode(parseInt(m[0], 8)); j += m[0].length; continue; }
    if (d === 'c' && s[j + 2] !== undefined) { out += String.fromCharCode(s.charCodeAt(j + 2) & 31); j += 2; continue; }
    out += '\\' + d;
    j++;
  }
  return out;
}

// Command substitutions inside text where quotes are literal (heredoc bodies, ${...}).
function extractSubs(text, ctx) {
  const subs = [];
  for (let j = 0; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') { j++; continue; }
    if (c === '$' && text[j + 1] === '(' && text[j + 2] === '(') {
      const r = skipArith(text, j + 3);
      if (!r.ok) { ctx.unsure = true; break; }
      ctx.arith.push(text.slice(j + 3, r.end - 1));
      j = r.end;
      continue;
    }
    if (c === '$' && text[j + 1] === '(') {
      const r = skipCmdSub(text, j + 2);
      if (!r.ok) { ctx.unsure = true; break; }
      subs.push(text.slice(j + 2, r.end));
      j = r.end;
      continue;
    }
    if (c === '`') {
      const r = skipBacktick(text, j + 1);
      if (!r.ok) { ctx.unsure = true; break; }
      subs.push(text.slice(j + 1, r.end));
      j = r.end;
    }
  }
  return subs;
}

// ---------------------------------------------------------------------------
// Tokenizer: segments of words + redirections + stdin sources. Not a full shell
// parser; it records ctx.unsure when it meets something it cannot close.
// ---------------------------------------------------------------------------

function newSeg() {
  return { words: [], redirs: [], inFiles: [], stdin: [], pipedFrom: null };
}

// "$(pwd)" is rendered as "$PWD" so target expansion can resolve it.
function subPlaceholder(body) {
  return /^\s*pwd(\s+-[LP])?\s*$/.test(body) ? '$PWD' : '$(...)';
}

function tokenize(src, ctx) {
  const segments = [];
  const subs = [];
  let seg = newSeg();
  let word = null;
  let pendingRedir = null;   // 'out' | 'in' | 'herestring'
  let heredocs = [];         // [{ delim, strip, quoted, seg }]

  function endWord() {
    if (word === null) return;
    const w = word;
    word = null;
    if (pendingRedir === 'out') {
      if (!/^&?[0-9-]$/.test(w)) seg.redirs.push(w);
    } else if (pendingRedir === 'in') {
      seg.inFiles.push(w);
    } else if (pendingRedir === 'herestring') {
      seg.stdin.push(w);
    } else {
      seg.words.push(w);
    }
    pendingRedir = null;
  }
  function endSeg(sep) {
    endWord();
    pendingRedir = null;
    const prev = seg;
    const hasContent = prev.words.length || prev.redirs.length || prev.stdin.length || prev.inFiles.length;
    if (hasContent || heredocs.some((h) => h.seg === prev)) segments.push(prev);
    seg = newSeg();
    if (sep === '|' && hasContent) seg.pipedFrom = prev;
  }
  // "((cmd; cmd))" may be nested subshells rather than arithmetic: analyse
  // command-looking bodies as commands too.
  function arithBody(body, list) {
    ctx.arith.push(body);
    extractSubs(body, ctx).forEach((x) => list.push(x));
    if (/[;&|\n]|[A-Za-z_-]\s+[A-Za-z-]/.test(body)) list.push(body);
  }
  function pushSub(body) {
    subs.push(body);
    return subPlaceholder(body);
  }
  // Double-quoted content starting after the opening quote; returns [text, endIndex].
  function readDouble(i) {
    let buf = '';
    let j = i;
    while (j < src.length && src[j] !== '"') {
      const c = src[j];
      if (c === '\\' && j + 1 < src.length) { buf += src[j + 1]; j += 2; continue; }
      if (c === '$' && src[j + 1] === '(' && src[j + 2] === '(') {
        const r = skipArith(src, j + 3);
        if (!r.ok) { ctx.unsure = true; return [buf, src.length]; }
        arithBody(src.slice(j + 3, r.end - 1), subs);
        buf += '0';
        j = r.end + 1;
        continue;
      }
      if (c === '$' && src[j + 1] === '(') {
        const r = skipCmdSub(src, j + 2);
        if (!r.ok) { ctx.unsure = true; return [buf, src.length]; }
        buf += pushSub(src.slice(j + 2, r.end));
        j = r.end + 1;
        continue;
      }
      if (c === '$' && src[j + 1] === '{') {
        const r = skipBrace(src, j + 2);
        if (!r.ok) { ctx.unsure = true; return [buf, src.length]; }
        const inner = src.slice(j + 2, r.end);
        ctx.braces.push(inner);
        extractSubs(inner, ctx).forEach((x) => subs.push(x));
        buf += '${' + inner + '}';
        j = r.end + 1;
        continue;
      }
      if (c === '`') {
        const r = skipBacktick(src, j + 1);
        if (!r.ok) { ctx.unsure = true; return [buf, src.length]; }
        buf += pushSub(src.slice(j + 1, r.end));
        j = r.end + 1;
        continue;
      }
      buf += c;
      j++;
    }
    if (j >= src.length) ctx.unsure = true;
    return [buf, j];
  }

  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];

    if (c === '\'') {
      const r = skipSingle(src, i + 1);
      if (!r.ok) ctx.unsure = true;
      word = (word || '') + src.slice(i + 1, r.end);
      i = r.end + 1;
      continue;
    }
    if (c === '$' && src[i + 1] === '\'') {
      const r = skipAnsi(src, i + 2);
      if (!r.ok) ctx.unsure = true;
      word = (word || '') + decodeAnsi(src, i + 2, r.end);
      i = r.end + 1;
      continue;
    }
    if (c === '"' || (c === '$' && src[i + 1] === '"')) {
      const [text, end] = readDouble(c === '"' ? i + 1 : i + 2);
      word = (word || '') + text;
      i = end + 1;
      continue;
    }
    if (c === '\\') {
      if (src[i + 1] === '\n') { i += 2; continue; }
      word = (word || '') + (src[i + 1] || '');
      i += 2;
      continue;
    }
    if (c === '$' && src[i + 1] === '(' && src[i + 2] === '(') {
      const r = skipArith(src, i + 3);
      if (!r.ok) { ctx.unsure = true; break; }
      arithBody(src.slice(i + 3, r.end - 1), subs);
      word = (word || '') + '0';
      i = r.end + 1;
      continue;
    }
    if (c === '$' && src[i + 1] === '(') {
      const r = skipCmdSub(src, i + 2);
      if (!r.ok) { ctx.unsure = true; subs.push(src.slice(i + 2)); break; }
      word = (word || '') + pushSub(src.slice(i + 2, r.end));
      i = r.end + 1;
      continue;
    }
    if (c === '$' && src[i + 1] === '{') {
      const r = skipBrace(src, i + 2);
      if (!r.ok) { ctx.unsure = true; break; }
      const inner = src.slice(i + 2, r.end);
      ctx.braces.push(inner);
      extractSubs(inner, ctx).forEach((x) => subs.push(x));
      word = (word || '') + '${' + inner + '}';
      i = r.end + 1;
      continue;
    }
    if (c === '`') {
      const r = skipBacktick(src, i + 1);
      if (!r.ok) { ctx.unsure = true; subs.push(src.slice(i + 1)); break; }
      word = (word || '') + pushSub(src.slice(i + 1, r.end));
      i = r.end + 1;
      continue;
    }
    if (c === '#' && word === null) {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '\n') {
      endSeg('\n');
      i++;
      if (heredocs.length) {
        const r = readHeredocBodies(src, i, heredocs);
        heredocs.forEach((h, k) => {
          const body = r.bodies[k];
          if (body === undefined) return;
          h.seg.stdin.push(body);
          if (!h.quoted) extractSubs(body, ctx).forEach((x) => subs.push(x));
        });
        heredocs = [];
        i = r.end;
      }
      continue;
    }
    // (( arithmetic command )) at the start of a command.
    if (c === '(' && src[i + 1] === '(' && word === null && CMD_START_RE.test(src.slice(0, i))) {
      const r = skipArith(src, i + 2);
      if (!r.ok) { ctx.unsure = true; break; }
      arithBody(src.slice(i + 2, r.end - 1), subs);
      i = r.end + 1;
      continue;
    }
    // Process substitution <(...) and >(...).
    if ((c === '<' || c === '>') && src[i + 1] === '(') {
      const r = skipCmdSub(src, i + 2);
      if (!r.ok) { ctx.unsure = true; subs.push(src.slice(i + 2)); break; }
      subs.push(src.slice(i + 2, r.end));
      if (word === null && pendingRedir === null) word = '/dev/fd/63';
      i = r.end + 1;
      continue;
    }
    if (c === ';' || c === '&' || c === '|' || c === '(' || c === ')') {
      if (c === '&' && src[i + 1] === '>') {
        endWord();
        pendingRedir = 'out';
        i += src[i + 2] === '>' ? 3 : 2;
        continue;
      }
      let sep = c;
      let step = 1;
      if (c === '|' && src[i + 1] === '|') { sep = '||'; step = 2; }
      else if (c === '|' && src[i + 1] === '&') { sep = '|'; step = 2; }
      else if (c === '&' && src[i + 1] === '&') { sep = '&&'; step = 2; }
      else if (c === ';' && src[i + 1] === ';') { sep = ';;'; step = 2; }
      endSeg(sep);
      i += step;
      continue;
    }
    if (c === '>' || c === '<') {
      // A word made only of digits right before the operator is an fd number.
      if (word !== null && /^[0-9]+$/.test(word)) word = null;
      else endWord();
      if (c === '>') {
        let j = i + 1;
        if (src[j] === '>' || src[j] === '|') j++;
        if (src[j] === '&') j++;
        pendingRedir = 'out';
        i = j;
        continue;
      }
      if (src.slice(i, i + 3) === '<<<') { pendingRedir = 'herestring'; i += 3; continue; }
      if (src.slice(i, i + 2) === '<<') {
        let k = i + 2;
        let strip = false;
        if (src[k] === '-') { strip = true; k++; }
        const h = readHeredocWord(src, k);
        if (!h.ok) { ctx.unsure = true; i = h.end; continue; }
        heredocs.push({ delim: h.delim, strip, quoted: h.quoted, seg });
        i = h.end;
        continue;
      }
      if (src[i + 1] === '>') { pendingRedir = 'out'; i += 2; continue; } // <> read-write
      pendingRedir = 'in';
      i += src[i + 1] === '&' ? 2 : 1;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      endWord();
      i++;
      continue;
    }
    word = (word || '') + c;
    i++;
  }
  endSeg('end');
  // Heredoc on the last line without a body: bash reads nothing; not unsafe.
  return { segments, subs };
}

// ---------------------------------------------------------------------------
// Segment analysis
// ---------------------------------------------------------------------------

const KEYWORDS = new Set(['!', '{', '}', 'then', 'do', 'done', 'else', 'elif', 'fi', 'if', 'while', 'until', 'time', 'coproc', 'esac']);
const ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)(\[[^\]]*\])?\+?=/;
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'mksh', 'yash', 'fish', 'busybox']);
const PTY_WRAPPERS = new Set(['script', 'expect', 'unbuffer', 'socat', 'empty', 'ptyrun', 'pty']);
const DECLARERS = new Set(['export', 'declare', 'typeset', 'local', 'readonly', 'integer']);
const TEXT_TOOLS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'echo', 'printf', 'cat', 'less', 'more',
  'head', 'tail', 'sed', 'awk', 'git', 'find', 'ls', 'wc', 'diff', 'sort', 'uniq', 'vim', 'nvim', 'code', 'man', 'which', 'type']);
const SQL_CLIENTS = new Set(['psql', 'mysql', 'mariadb', 'sqlite3', 'sqlite', 'sqlcmd', 'pgcli', 'mycli', 'litecli',
  'usql', 'duckdb', 'clickhouse-client', 'snowsql', 'mongosh', 'mongo', 'cqlsh', 'dbshell', 'dbconsole', 'bq']);
const SQL_DESTRUCTIVE_RE = /\b(DROP\s+(TABLE|DATABASE|SCHEMA|COLLECTION)\b|TRUNCATE\s+(TABLE\s+)?[A-Za-z_"`[])|\bdropDatabase\s*\(|\.drop\s*\(\s*\)/i;
const MUTATORS = new Set(['rm', 'unlink', 'rmdir', 'shred', 'mv', 'chmod', 'chown', 'chflags', 'chgrp', 'xattr', 'setfacl']);
const GIT_OPTS_WITH_ARG = /^(-c|-C|--git-dir|--work-tree|--namespace|--config-env|--super-prefix|--exec-path)$/;
const GIT_BUILTINS = new Set(('add am annotate apply archive bisect blame branch bundle cat-file check-attr check-ignore ' +
  'checkout cherry cherry-pick citool clean clone commit commit-graph commit-tree config count-objects describe ' +
  'diff diff-files diff-index diff-tree difftool fetch for-each-ref format-patch fsck gc grep hash-object help ' +
  'init log ls-files ls-remote ls-tree maintenance merge merge-base mergetool mv notes prune pull push range-diff ' +
  'read-tree rebase reflog remote repack replace reset restore rev-list rev-parse revert rm shortlog show ' +
  'show-branch show-ref sparse-checkout stash status submodule switch symbolic-ref tag update-index update-ref ' +
  'var verify-commit verify-tag version whatchanged worktree write-tree').split(' '));

function basename(w) {
  return path.basename(String(w || ''));
}

// Strip keywords, env assignments and simple command wrappers. Records assignments,
// unsets and environment clearing on info.
function stripPrefix(words, info) {
  const w = words.slice();
  for (let guard = 0; guard < 24 && w.length; guard++) {
    const head = w[0];
    const base = basename(head);
    let m;
    if (KEYWORDS.has(head)) { w.shift(); continue; }
    if ((m = ASSIGN_RE.exec(head))) { info.assigned.add(m[1]); w.shift(); continue; }
    if (base === 'sudo' || base === 'doas') {
      w.shift();
      while (w.length && w[0].startsWith('-')) {
        const opt = w.shift();
        if (/^-[ugCDhpRrtT]$/.test(opt) && w.length) w.shift();
      }
      continue;
    }
    if (base === 'env') {
      w.shift();
      while (w.length && (w[0].startsWith('-') || ASSIGN_RE.test(w[0]))) {
        const opt = w.shift();
        if ((m = ASSIGN_RE.exec(opt))) { info.assigned.add(m[1]); continue; }
        if (opt === '-' || opt === '-i' || opt === '--ignore-environment' || /^-[a-zA-Z]*i/.test(opt) && !opt.startsWith('--')) info.clearEnv = true;
        if (opt === '-u' || opt === '--unset') { if (w.length) info.unset.add(w.shift()); continue; }
        if (/^-u./.test(opt)) { info.unset.add(opt.slice(2)); continue; }
        if (/^--unset=/.test(opt)) { info.unset.add(opt.slice(8)); continue; }
        if (/^-[SC]$/.test(opt) && w.length) {
          const val = w.shift();
          if (opt === '-S') { w.unshift(...val.split(/\s+/).filter(Boolean)); }
        }
      }
      continue;
    }
    if (base === 'command' || base === 'exec' || base === 'nohup' || base === 'builtin' || base === 'setsid' || base === 'caffeinate') {
      w.shift();
      while (w.length && w[0].startsWith('-')) {
        const opt = w.shift();
        if (base === 'exec' && /c/.test(opt)) info.clearEnv = true;
        if (base === 'exec' && opt === '-a' && w.length) w.shift();
      }
      continue;
    }
    if (base === 'nice' || base === 'ionice' || base === 'stdbuf' || base === 'chrt' || base === 'taskset') {
      w.shift();
      while (w.length && w[0].startsWith('-')) {
        const opt = w.shift();
        if (/^-[ncipoe]$/.test(opt) && w.length) w.shift();
      }
      continue;
    }
    if (base === 'timeout' || base === 'gtimeout') {
      w.shift();
      while (w.length && w[0].startsWith('-')) {
        const opt = w.shift();
        if (/^-[sk]$/.test(opt) && w.length) w.shift();
      }
      if (w.length) w.shift(); // duration
      continue;
    }
    if (base === 'xargs') {
      w.shift();
      while (w.length && w[0].startsWith('-')) {
        const opt = w.shift();
        if (/^-[nILPdEsa]$/.test(opt) && w.length) w.shift();
      }
      continue;
    }
    break;
  }
  return w;
}

function nonOptions(args) {
  return args.filter((a) => a && !a.startsWith('-'));
}

// Expand the variables the hook can know: ~, $HOME, $PWD, $(pwd), $CLAUDE_PROJECT_DIR.
// Returns { value, resolved }; resolved=false when another expansion remains.
function expandPath(w, ctx) {
  let v = String(w);
  const home = ctx.home || '';
  if (home) v = v.replace(/^~(?=\/|$)/, home);
  v = v.replace(/\$\{HOME\}|\$HOME(?![A-Za-z0-9_])/g, home || '$HOME');
  v = v.replace(/\$\{PWD\}|\$PWD(?![A-Za-z0-9_])/g, ctx.cwd);
  v = v.replace(/\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR(?![A-Za-z0-9_])/g, ctx.root);
  const resolved = !/[$`]|^~/.test(v);
  return { value: v, resolved };
}

function isWithin(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function readSmallFile(p, ctx) {
  try {
    const abs = path.resolve(ctx.cwd, p);
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > MAX_SQL_FILE_BYTES) return '';
    return fs.readFileSync(abs, 'utf8');
  } catch (e) {
    return '';
  }
}

function lookupGitAlias(name, ctx) {
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return null;
  try {
    const r = spawnSync('git', ['config', '--get', `alias.${name}`], { cwd: ctx.cwd, encoding: 'utf8', timeout: 1500 });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch (e) { /* git missing */ }
  return null;
}

function simpleWords(text, ctx) {
  const t = tokenize(text, { unsure: false, arith: [], braces: [], cwd: ctx.cwd });
  return t.segments.length ? t.segments[0].words : [];
}

function analyzeGit(args, out, ctx, depth) {
  let k = 0;
  const aliases = {};
  while (k < args.length && args[k].startsWith('-')) {
    const opt = args[k];
    k++;
    let cfg = null;
    if (GIT_OPTS_WITH_ARG.test(opt)) {
      if (opt === '-c') cfg = args[k];
      k++;
    } else if (/^-c./.test(opt)) {
      cfg = opt.slice(2);
    }
    const m = cfg && /^alias\.([^=]+)=(.*)$/is.exec(cfg);
    if (m) aliases[m[1].toLowerCase()] = m[2];
  }
  let sub = args[k];
  let rest = args.slice(k + 1);
  for (let guard = 0; guard < 6 && sub; guard++) {
    let val = Object.prototype.hasOwnProperty.call(aliases, sub.toLowerCase()) ? aliases[sub.toLowerCase()] : undefined;
    if (val === undefined && !GIT_BUILTINS.has(sub)) val = lookupGitAlias(sub, ctx);
    if (val === undefined || val === null) break;
    if (val.startsWith('!')) {
      analyze(`${val.slice(1)} ${rest.map(shq).join(' ')}`, out, depth + 1, ctx);
      return;
    }
    const parts = simpleWords(val, ctx);
    if (!parts.length) break;
    sub = parts[0];
    rest = parts.slice(1).concat(rest);
  }
  if (!sub) return;

  const has = (re) => rest.some((a) => re.test(a));
  const shortHas = (ch) => rest.some((a) => /^-[a-zA-Z]+$/.test(a) && a.includes(ch));
  if (sub === 'config') {
    const ki = rest.findIndex((a) => /^core\.hookspath$/i.test(a));
    const reading = rest.some((a) => /^--(get|get-all|get-regexp|list)$/.test(a) || a === '-l');
    const unsetting = rest.some((a) => /^--(unset|unset-all|replace-all|edit)$/.test(a) || a === '-e');
    if (ki !== -1 && !reading && (unsetting || rest[ki + 1] !== undefined)) out.protectedHit = out.protectedHit || 'git config core.hooksPath';
  }
  if (sub === 'commit' || sub === 'commit-tree') out.gitCommit = true;
  if (sub === 'merge' && !has(/^--(abort|quit|ff-only|no-commit|squash)$/)) out.gitCommit = true;
  if (sub === 'cherry-pick' && !has(/^--(abort|quit|no-commit)$/) && !shortHas('n')) out.gitCommit = true;
  if (sub === 'revert' && !has(/^--(abort|quit|no-commit)$/) && !shortHas('n')) out.gitCommit = true;
  if (sub === 'am' && !has(/^--(abort|quit|show-current-patch(=.*)?)$/)) out.gitCommit = true;

  if (sub === 'reset' && rest.includes('--hard')) out.destructive = out.destructive || 'git reset --hard';
  if (sub === 'clean') {
    const force = rest.some((a) => a === '--force' || /^-[a-zA-Z]*f/.test(a));
    const dry = rest.some((a) => a === '--dry-run' || (/^-[a-zA-Z]+$/.test(a) && a.includes('n')));
    if (force && !dry) out.destructive = out.destructive || 'git clean -f';
  }
  if (sub === 'push' && rest.some((a) => a === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || /^\+/.test(a))) {
    out.destructive = out.destructive || 'git push --force';
  }
  if (sub === 'branch' && rest.some((a) => a === '-D' || (/^-[a-zA-Z]+$/.test(a) && a.includes('D')))) {
    out.destructive = out.destructive || 'git branch -D';
  }
}

function shq(w) {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(w) ? w : `'${String(w).replace(/'/g, '\'\\\'\'')}'`;
}

// SQL text a client segment receives: its arguments, heredoc/herestring stdin,
// -f/--file and < input files, and the words of the commands piped into it.
function sqlTextFor(seg, args, ctx) {
  const parts = args.slice();
  seg.stdin.forEach((s) => parts.push(s));
  seg.inFiles.forEach((f) => parts.push(readSmallFile(f, ctx)));
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if ((a === '-f' || a === '--file' || a === '-i' || a === '--input') && args[k + 1]) parts.push(readSmallFile(args[k + 1], ctx));
    else if (/^--file=/.test(a)) parts.push(readSmallFile(a.slice(7), ctx));
    else if (/^\.read$/.test(a) && args[k + 1]) parts.push(readSmallFile(args[k + 1], ctx));
  }
  for (let p = seg.pipedFrom, guard = 0; p && guard < 10; p = p.pipedFrom, guard++) {
    p.words.forEach((w) => parts.push(w));
    p.stdin.forEach((s) => parts.push(s));
    p.inFiles.forEach((f) => parts.push(readSmallFile(f, ctx)));
  }
  return parts.join('\n');
}

function sqlClientIndex(w) {
  if (!w.length || TEXT_TOOLS.has(basename(w[0]))) return -1;
  for (let k = 0; k < w.length; k++) {
    const b = basename(w[k]);
    if (SQL_CLIENTS.has(b)) return k;
    if (b === 'cockroach' && w[k + 1] === 'sql') return k + 1;
    if (b === 'supabase' && w[k + 1] === 'db') return k + 1;
    if (b === 'prisma' && w[k + 1] === 'db' && w[k + 2] === 'execute') return k + 2;
    if (b === 'wrangler' && w[k + 1] === 'd1') return k + 1;
    if (b === 'turso' && w[k + 1] === 'db' && w[k + 2] === 'shell') return k + 2;
    if (b === 'clickhouse' && w[k + 1] === 'client') return k + 1;
  }
  return -1;
}

// Names assigned / unset by builtins (export, declare, printf -v, read, for, let, unset ...).
function recordBuiltinAssignments(cmd, args, info) {
  const add = (name) => {
    if (!name) return;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(name);
    if (m) info.assigned.add(m[1]);
    else if (/^[$`]/.test(name)) info.indirect = true;
  };
  if (DECLARERS.has(cmd)) {
    const unexport = args.some((a) => a === '-n' && cmd === 'export') || args.some((a) => /^\+[a-zA-Z]*x/.test(a));
    args.forEach((a) => {
      if (/^[-+]/.test(a)) return;
      const eq = a.indexOf('=');
      const name = eq === -1 ? a : a.slice(0, eq).replace(/\+$/, '').replace(/\[.*$/, '');
      if (unexport) info.unset.add(name);
      add(name);
      // declare -n ref=NAME makes ref a nameref to NAME.
      if (eq !== -1) add(a.slice(eq + 1));
    });
    return;
  }
  if (cmd === 'printf') {
    for (let k = 0; k < args.length; k++) {
      if (args[k] === '-v') add(args[k + 1]);
      else if (/^-v./.test(args[k])) add(args[k].slice(2));
    }
    return;
  }
  if (cmd === 'read' || cmd === 'readarray' || cmd === 'mapfile') {
    args.forEach((a) => { if (!a.startsWith('-')) add(a); });
    return;
  }
  if (cmd === 'getopts') { add(args[1]); return; }
  if (cmd === 'let') { args.forEach((a) => add(a)); return; }
  if (cmd === 'for' || cmd === 'select') { add(args[0]); return; }
  if (cmd === 'unset') { args.forEach((a) => { if (!a.startsWith('-')) info.unset.add(a); }); }
}

function analyze(src, out, depth, ctx) {
  if (!src) return;
  if (depth > MAX_DEPTH) { ctx.unsure = true; return; }
  const { segments, subs } = tokenize(src, ctx);
  subs.forEach((s) => analyze(s, out, depth + 1, ctx));

  segments.forEach((seg) => {
    seg.redirs.forEach((t) => {
      if (!/^\/dev\//.test(t)) out.targets.push(t);
    });
    const w = stripPrefix(seg.words, ctx.info);
    if (!w.length) return;
    const cmd = basename(w[0]);
    const args = w.slice(1);

    recordBuiltinAssignments(cmd, args, ctx.info);

    // commit.sh must run as the literal command word ".agents/scripts/commit.sh" at the top
    // level, so the Claude Code ask rule Bash(.agents/scripts/commit.sh *) matches it.
    const head = seg.words.find((x) => !ASSIGN_RE.test(x));
    const isCommitSh = (x) => /(^|\/)commit\.sh$/.test(String(x || ''));
    if (isCommitSh(w[0])) {
      const canonical = depth === 0 && head === COMMIT_SH_CANONICAL && w[0] === COMMIT_SH_CANONICAL;
      out.commitSh.push(canonical ? 'canonical' : 'noncanonical');
    } else if ((SHELLS.has(cmd) || cmd === 'source' || cmd === '.') && args.some(isCommitSh)) {
      out.commitSh.push('noncanonical');
    } else if (/[$`]/.test(w[0]) && /commit\.sh/.test(src)) {
      out.commitSh.push('noncanonical');
    }

    // Command word built from an expansion ("$G commit", "$(echo git) commit"): unknown
    // command with a commit-creating subcommand is treated as git.
    if (/[$`]/.test(w[0]) && args.some((a) => /^(commit|commit-tree|merge|cherry-pick|revert|am)$/.test(a))) {
      out.gitCommit = true;
    }

    // Shells: -c strings are analysed; a shell reading a script from stdin is unknown.
    if (SHELLS.has(cmd)) {
      const ci = args.findIndex((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a));
      if (ci !== -1) {
        if (args[ci + 1] !== undefined) analyze(args[ci + 1], out, depth + 1, ctx);
        return;
      }
      const readsStdin = args.some((a) => /^-[a-zA-Z]*s[a-zA-Z]*$/.test(a)) || nonOptions(args).length === 0;
      if (readsStdin) {
        ctx.stdinShell = true;
        seg.stdin.forEach((body) => analyze(body, out, depth + 1, ctx));
      }
      return; // `bash script.sh` is not inspected (documented residual risk).
    }
    if (cmd === 'eval') { analyze(args.join(' '), out, depth + 1, ctx); return; }
    if (cmd === 'ssh') {
      let k = 0;
      while (k < args.length && args[k].startsWith('-')) {
        if (/^-[bcDEeFIiJLlmOopQRSWw]$/.test(args[k])) k++;
        k++;
      }
      if (args.length > k + 1) analyze(args.slice(k + 1).join(' '), out, depth + 1, ctx);
      return;
    }
    if (PTY_WRAPPERS.has(cmd)) {
      const text = normalizeRaw(args.join(' '));
      if (/commit\.sh|(^|[^A-Za-z0-9_.-])git([^A-Za-z0-9_.-]|$)/.test(text)) out.gitCommit = true;
    }
    if (cmd === 'find') {
      for (let k = 0; k < args.length; k++) {
        if (/^-(exec|execdir|ok|okdir)$/.test(args[k])) {
          const rest = [];
          for (k = k + 1; k < args.length && args[k] !== ';' && args[k] !== '+'; k++) rest.push(args[k]);
          analyze(rest.map(shq).join(' '), out, depth + 1, ctx);
        }
        if (args[k] === '-delete') out.destructive = out.destructive || 'find -delete';
      }
      return;
    }

    if (cmd === 'git') { analyzeGit(args, out, ctx, depth); return; }

    // SQL only counts when it reaches a database client.
    const si = sqlClientIndex(w);
    if (si !== -1) {
      const sub = w.slice(si);
      const b = basename(sub[0]);
      if (b === 'db' && sub[1] === 'reset') out.destructive = out.destructive || 'supabase db reset';
      const text = sqlTextFor(seg, sub.slice(1), ctx);
      if (SQL_DESTRUCTIVE_RE.test(text)) out.destructive = out.destructive || 'SQL DROP/TRUNCATE';
    }
    if (cmd === 'dropdb') { out.destructive = out.destructive || 'dropdb'; return; }
    if (cmd === 'prisma' && args[0] === 'migrate' && args[1] === 'reset') { out.destructive = out.destructive || 'prisma migrate reset'; return; }
    if ((cmd === 'rails' || cmd === 'rake') && args.some((a) => /^db:(drop|reset)/.test(a))) {
      out.destructive = out.destructive || `${cmd} db:drop/reset`;
      return;
    }

    if (cmd === 'rm') {
      let recursive = false;
      let force = false;
      args.forEach((a) => {
        if (a === '--recursive') recursive = true;
        else if (a === '--force') force = true;
        else if (/^-[a-zA-Z]+$/.test(a)) {
          if (/[rR]/.test(a)) recursive = true;
          if (/f/.test(a)) force = true;
        }
      });
      if (recursive && force) {
        const targets = nonOptions(args);
        let bad = targets.find((t) => /^(\/|~|\$HOME|\$\{HOME\}|\*|\.\.(\/|$)|\.\/?\*?$)/.test(t));
        if (!bad) {
          bad = targets.find((t) => {
            const e = expandPath(t, ctx);
            if (!e.resolved || e.value === t) return false;
            const abs = path.resolve(ctx.cwd, e.value);
            return isWithin(ctx.root, abs) || !isWithin(abs, ctx.root);
          });
        }
        if (bad) out.destructive = out.destructive || `rm -rf ${bad}`;
      }
      return;
    }
    if (/^mkfs(\.|$)/.test(cmd)) { out.destructive = out.destructive || cmd; return; }
    if (cmd === 'aws' && args[0] === 's3' && (args[1] === 'rm' || args[1] === 'rb')) { out.destructive = out.destructive || `aws s3 ${args[1]}`; return; }
    if (cmd === 'gcloud' && args.includes('projects') && args.includes('delete')) { out.destructive = out.destructive || 'gcloud projects delete'; return; }

    // Paths the command moves, deletes or re-permissions: checked only against the
    // protected gate-state paths (.git/devos-*, .git/hooks/*), never against the file gates.
    if (MUTATORS.has(cmd)) nonOptions(args).forEach((f) => out.mutates.push(f));

    // Write targets for the file gates.
    const files = nonOptions(args);
    if (cmd === 'touch' || cmd === 'tee' || cmd === 'truncate') {
      files.forEach((f) => out.targets.push(f));
    } else if (cmd === 'cp' || cmd === 'mv' || cmd === 'install' || cmd === 'ln' || cmd === 'rsync') {
      const t = args.indexOf('-t');
      if (t !== -1 && args[t + 1]) out.targets.push(args[t + 1]);
      else if (files.length >= 2) out.targets.push(files[files.length - 1]);
    } else if ((cmd === 'sed' || cmd === 'perl') && args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) {
      const hasScriptFlag = args.some((a) => a === '-e' || /^-[a-zA-Z]*e$/.test(a));
      (hasScriptFlag ? files : files.slice(1)).forEach((f) => out.targets.push(f));
    } else if (cmd === 'dd') {
      args.forEach((a) => { if (a.startsWith('of=')) out.targets.push(a.slice(3)); });
    } else if (/write|create/i.test(cmd)) {
      files.forEach((f) => out.targets.push(f));
    }
  });
}

// ---------------------------------------------------------------------------
// Conservative fallback over raw text (unparseable input, scripts on stdin).
// Mirrored in pre-tool-use.sh for when node itself fails.
// ---------------------------------------------------------------------------

function normalizeRaw(s) {
  return String(s).replace(/\$(['"])/g, '$1').replace(/['"\\]/g, '');
}

const B = '(^|[^A-Za-z0-9_.-])';
const FB_COMMIT_RE = new RegExp(`${B}git([^A-Za-z0-9_.-][^;&|\\n]*)?[ \\t](commit|commit-tree|merge|cherry-pick|revert|am)([^A-Za-z0-9_-]|$)|alias\\.[A-Za-z0-9_-]+=[ \\t]*!?[ \\t]*(git[ \\t]+)?commit`);
const FB_DESTRUCTIVE = [
  [new RegExp(`${B}rm[ \\t]+([^;&|\\n]*[ \\t])?(-[A-Za-z]*([rR][A-Za-z]*f|f[A-Za-z]*[rR])|--recursive|--force)`), 'rm -rf (fallback)'],
  [new RegExp(`${B}git[^;&|\\n]*[ \\t]reset[^;&|\\n]*--hard`), 'git reset --hard (fallback)'],
  [new RegExp(`${B}git[^;&|\\n]*[ \\t]clean[^;&|\\n]*([ \\t]-[A-Za-z]*f|--force)`), 'git clean -f (fallback)'],
  [new RegExp(`${B}git[^;&|\\n]*[ \\t]push[^;&|\\n]*([ \\t]--force([^-]|$)|[ \\t]-[A-Za-z]*f([^A-Za-z]|$)|[ \\t]\\+[^ \\t])`), 'git push --force (fallback)'],
  [new RegExp(`${B}git[^;&|\\n]*[ \\t]branch[^;&|\\n]*[ \\t]-[A-Za-z]*D`), 'git branch -D (fallback)'],
  [/\b(DROP[ \t\n]+(TABLE|DATABASE|SCHEMA)|TRUNCATE[ \t\n]+TABLE)\b/i, 'SQL DROP/TRUNCATE (fallback)'],
  [new RegExp(`${B}mkfs`), 'mkfs (fallback)'],
  [new RegExp(`${B}find[^;&|\\n]*[ \\t]-delete`), 'find -delete (fallback)'],
  [/\baws[ \t]+s3[ \t]+(rm|rb)\b/, 'aws s3 rm/rb (fallback)'],
  [/\bgcloud\b[^;&|\n]*projects[ \t]+delete\b/, 'gcloud projects delete (fallback)']
];
const FB_APPROVAL_RE = /DEVOS_(HEADLESS_COMMIT|COMMIT_APPROVED|AGENT_COMMIT)/;
// Fallback: every mention of commit.sh must be the canonical command word at a command start.
const FB_COMMIT_SH_RE = /\S*commit\.sh/g;
function fallbackCommitSh(t) {
  const forms = [];
  let m;
  FB_COMMIT_SH_RE.lastIndex = 0;
  while ((m = FB_COMMIT_SH_RE.exec(t))) {
    const atStart = /(^|[;&|(])\s*$/.test(t.slice(0, m.index));
    forms.push(m[0] === COMMIT_SH_CANONICAL && atStart ? 'canonical' : 'noncanonical');
  }
  return forms;
}
const MARKER_RE = new RegExp(`\\b(${AGENT_MARKERS.join('|')})\\b`);
const COMMIT_TOOL_RE = new RegExp(`commit\\.sh|${B}git([^A-Za-z0-9_.-]|$)`);
const PTY_FB_RE = new RegExp(`${B}(script|expect|unbuffer|socat|empty|ptyrun|pty)[ \\t]`);
const ENV_CLEAR_RE = /(^|[^A-Za-z0-9_.-])(env[ \t]+(-[A-Za-z]*i|--ignore-environment|-[ \t])|exec[ \t]+-[A-Za-z]*c)/;

function fallbackScan(raw, out) {
  const t = normalizeRaw(raw);
  if (FB_COMMIT_RE.test(t)) out.gitCommit = true;
  for (const [re, why] of FB_DESTRUCTIVE) {
    if (re.test(t)) { out.destructive = out.destructive || why; break; }
  }
  if (FB_APPROVAL_RE.test(t)) out.approval = true;
  if ((MARKER_RE.test(t) || ENV_CLEAR_RE.test(t)) && COMMIT_TOOL_RE.test(t)) out.markerTamper = true;
  if (PTY_FB_RE.test(t) && COMMIT_TOOL_RE.test(t)) out.gitCommit = true;
  out.commitSh.push(...fallbackCommitSh(t));
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function realish(p) {
  try { return fs.realpathSync(p); } catch (e) { /* fall through */ }
  const parent = path.dirname(p);
  if (parent === p) return p;
  return path.join(realish(parent), path.basename(p));
}

function findRoot(startDir) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  let dir = path.resolve(startDir);
  for (;;) {
    try { if (fs.statSync(path.join(dir, '.agents')).isDirectory()) return dir; } catch (e) { /* keep walking */ }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(startDir);
    dir = parent;
  }
}

// Returns { rel } for a path inside ROOT, { unresolved } for a path that still
// contains an unknown expansion, or null for a path outside ROOT.
function relTarget(ctx, t) {
  if (!t) return null;
  const e = expandPath(t, ctx);
  if (!e.resolved) return { unresolved: t };
  const abs = realish(path.resolve(ctx.cwd, e.value));
  const rel = path.relative(realish(ctx.root), abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return { rel: rel.split(path.sep).join('/') };
}

// Dev-OS gate state the agent must not write, move or delete: the TRIVIAL budget and session
// stamp (.git/devos-*) and the git hooks (.git/hooks/*, the commit-gate backstop).
const PROTECTED_RE = /(^|\/)\.git\/(worktrees\/[^/]+\/)?(devos-[^/]*|hooks(\/.*)?)$/;
const STATE_NAME_RE = /devos-(trivial-budget|session-stamp)/;
function protectedPaths(cands, ctx) {
  const hits = [];
  cands.forEach((t) => {
    if (typeof t !== 'string' || !t) return;
    const raw = t.replace(/\/+$/, '');
    let hit = PROTECTED_RE.test(raw) || STATE_NAME_RE.test(raw);
    if (!hit) {
      const e = expandPath(t, ctx);
      if (e.resolved) {
        const abs = realish(path.resolve(ctx.cwd, e.value)).replace(/\/+$/, '');
        hit = PROTECTED_RE.test(abs) || STATE_NAME_RE.test(abs);
      } else {
        hit = /\.git\/(worktrees\/[^/]+\/)?(devos-|hooks(\/|$))/.test(raw);
      }
    }
    if (hit && !hits.includes(t)) hits.push(t);
  });
  return hits;
}
function sessionId(input) {
  return typeof input.session_id === 'string' ? input.session_id.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128) : '';
}

// Size of an Edit for the TRIVIAL fast path. Anything that is not a plain string edit
// of an existing file reports EDIT_EXISTS=0 so the fast path never applies.
const EDIT_MAX_READ_BYTES = 1024 * 1024;
function countLines(s) { return s === '' ? 0 : s.split('\n').length; }
function editStats(ti, abs) {
  const oldS = ti.old_string;
  const newS = ti.new_string;
  let exists = false;
  try { exists = fs.statSync(abs).isFile(); } catch (e) { exists = false; }
  if (typeof oldS !== 'string' || typeof newS !== 'string' || oldS === '') exists = false;
  if (!exists) return ['EDIT_EXISTS=0', 'EDIT_LINES=0', 'EDIT_BYTES=0'];
  let times = 1;
  if (ti.replace_all === true) {
    try {
      if (fs.statSync(abs).size > EDIT_MAX_READ_BYTES) return ['EDIT_EXISTS=1', 'EDIT_LINES=999999', 'EDIT_BYTES=999999'];
      times = Math.max(1, fs.readFileSync(abs, 'utf8').split(oldS).length - 1);
    } catch (e) { return ['EDIT_EXISTS=1', 'EDIT_LINES=999999', 'EDIT_BYTES=999999']; }
  }
  const n = Math.max(countLines(oldS), countLines(newS)) * times;
  return ['EDIT_EXISTS=1', `EDIT_LINES=${n}`, `EDIT_BYTES=${(oldS.length + newS.length) * times}`];
}

// ---------------------------------------------------------------------------

function commitShForm(forms) {
  if (forms.includes('noncanonical')) return 'noncanonical';
  return forms.includes('canonical') ? 'canonical' : 'none';
}

function buildLines(input, parseMode) {
  const ti = (input && typeof input.tool_input === 'object' && input.tool_input) || {};
  const toolName = typeof input.tool_name === 'string' ? input.tool_name : '';
  const command = typeof ti.command === 'string' ? ti.command : '';
  let filePath = '';
  if (typeof ti.file_path === 'string') filePath = ti.file_path;
  else if (typeof ti.notebook_path === 'string') filePath = ti.notebook_path;
  const cwd = typeof input.cwd === 'string' && fs.existsSync(input.cwd) ? input.cwd : process.cwd();
  const root = findRoot(cwd);

  const ctx = {
    cwd, root, home: process.env.HOME || '',
    unsure: false, stdinShell: false, arith: [], braces: [],
    info: { assigned: new Set(), unset: new Set(), clearEnv: false, indirect: false }
  };
  const out = { gitCommit: false, destructive: '', targets: [], mutates: [], approval: false, markerTamper: false, protectedHit: '', commitSh: [] };

  if (command) {
    analyze(command, out, 0, ctx);

    // Arithmetic and ${NAME:=value} assignments.
    const nameAssign = (text, name) => new RegExp(`(^|[^A-Za-z0-9_])${name}\\s*([-+*/%&|^]|<<|>>)?=(?!=)|(\\+\\+|--)\\s*${name}\\b|\\b${name}\\s*(\\+\\+|--)`).test(text);
    ctx.arith.forEach((a) => {
      APPROVAL_VARS.concat(AGENT_MARKERS).forEach((v) => { if (nameAssign(a, v)) ctx.info.assigned.add(v); });
    });
    ctx.braces.forEach((b) => {
      const m = /^([A-Za-z_][A-Za-z0-9_]*):?=/.exec(b);
      if (m) ctx.info.assigned.add(m[1]);
    });

    const norm = normalizeRaw(command);
    if (APPROVAL_VARS.some((v) => ctx.info.assigned.has(v))) out.approval = true;
    if (ctx.info.indirect && /DEVOS_(HEADLESS|COMMIT|AGENT_COMMIT)/.test(norm)) out.approval = true;
    const tamper = ctx.info.clearEnv || AGENT_MARKERS.some((v) => ctx.info.assigned.has(v) || ctx.info.unset.has(v));
    if (tamper && COMMIT_TOOL_RE.test(norm)) out.markerTamper = true;

    if (ctx.unsure || ctx.stdinShell) fallbackScan(command, out);
    if (STATE_NAME_RE.test(norm)) out.protectedHit = out.protectedHit || 'names the TRIVIAL budget or session stamp file';
  }
  if (filePath) out.targets.unshift(filePath);
  const prot = protectedPaths(out.targets.concat(out.mutates), ctx);
  if (out.protectedHit) prot.unshift(out.protectedHit);

  const lines = [
    `PARSE=${parseMode}`,
    `EVENT=${flat(input.hook_event_name)}`,
    `TOOL_NAME=${flat(toolName)}`,
    `COMMAND=${flat(command)}`,
    `FILE_PATH=${flat(filePath)}`,
    `STOP_HOOK_ACTIVE=${input.stop_hook_active === true ? 'true' : 'false'}`,
    `SOURCE=${flat(input.source)}`,
    `ROOT=${flat(root)}`,
    `GIT_COMMIT=${out.gitCommit ? 1 : 0}`,
    `APPROVAL_ENV=${out.approval ? 1 : 0}`,
    `MARKER_TAMPER=${out.markerTamper ? 1 : 0}`,
    `COMMIT_SH=${commitShForm(out.commitSh)}`,
    `DESTRUCTIVE=${flat(out.destructive)}`,
    `UNSURE=${ctx.unsure || ctx.stdinShell ? 1 : 0}`,
    `SESSION_ID=${sessionId(input)}`
  ];
  prot.forEach((p) => lines.push(`PROTECTED=${flat(p)}`));
  if (toolName === 'Edit' && filePath) lines.push(...editStats(ti, path.resolve(cwd, filePath)));
  const seen = new Set();
  out.targets.forEach((t) => {
    const r = relTarget(ctx, t);
    if (!r) return;
    const key = r.rel !== undefined ? `TARGET=${flat(r.rel)}` : `UTARGET=${flat(r.unresolved)}`;
    if (!seen.has(key)) { seen.add(key); lines.push(key); }
  });
  return lines;
}

// Stdin that was cut off by the read timeout, or that looks like JSON but does not parse.
// Nothing in it can be trusted structurally, so: the conservative fallback regex over the
// whole text, the tool name and file_path if they can be found, and when a file tool's
// file_path cannot be found, every path-like string as a write target.
const PATHLIKE_RE = /[A-Za-z0-9_.~@%+\/-]+\.(tsx|jsx|vue|svelte|html|css|ts|js|mjs|cjs|py|rb|go|rs|java|php|sql)(?![A-Za-z0-9_])/g;
const MAX_PATHLIKE = 200;
function jsonStringField(text, name) {
  const m = new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text);
  if (!m) return null;
  try { return JSON.parse(`"${m[1]}"`); } catch (e) { return m[1]; }
}
function partialLines(text) {
  const cwdField = jsonStringField(text, 'cwd');
  const cwd = cwdField && fs.existsSync(cwdField) ? cwdField : process.cwd();
  const root = findRoot(cwd);
  const ctx = { cwd, root, home: process.env.HOME || '' };
  const out = { gitCommit: false, destructive: '', targets: [], approval: false, markerTamper: false, commitSh: [] };
  fallbackScan(text, out);
  const toolName = jsonStringField(text, 'tool_name') || '';
  const filePath = jsonStringField(text, 'file_path') || jsonStringField(text, 'notebook_path');
  const prot = [];
  if (STATE_NAME_RE.test(text)) prot.push('names the TRIVIAL budget or session stamp file');
  if (/\.git\/(worktrees\/[^/]+\/)?hooks\//.test(normalizeRaw(text))) prot.push('mentions .git/hooks/');
  if (toolName !== 'Bash') {
    if (filePath) out.targets.push(filePath);
    else {
      const seen = new Set();
      let m;
      PATHLIKE_RE.lastIndex = 0;
      while ((m = PATHLIKE_RE.exec(text)) && seen.size < MAX_PATHLIKE) {
        if (!seen.has(m[0])) { seen.add(m[0]); out.targets.push(m[0]); }
      }
    }
  }
  const lines = [
    'PARSE=partial',
    'EVENT=PreToolUse',
    `TOOL_NAME=${flat(toolName)}`,
    'COMMAND=',
    `FILE_PATH=${flat(filePath || '')}`,
    `ROOT=${flat(root)}`,
    `GIT_COMMIT=${out.gitCommit ? 1 : 0}`,
    `APPROVAL_ENV=${out.approval ? 1 : 0}`,
    `MARKER_TAMPER=${out.markerTamper ? 1 : 0}`,
    `COMMIT_SH=${commitShForm(out.commitSh)}`,
    `DESTRUCTIVE=${flat(out.destructive)}`,
    'UNSURE=1',
    `SESSION_ID=${flat((jsonStringField(text, 'session_id') || '').replace(/[^A-Za-z0-9._-]/g, ''))}`
  ];
  protectedPaths(out.targets, ctx).forEach((p) => prot.push(p));
  prot.forEach((p) => lines.push(`PROTECTED=${flat(p)}`));
  const seen = new Set();
  out.targets.forEach((t) => {
    const r = relTarget(ctx, t);
    // Partial input is untrusted: keep targets outside ROOT too, by their raw text.
    const key = r && r.rel !== undefined ? `TARGET=${flat(r.rel)}` : `UTARGET=${flat(t)}`;
    if (!seen.has(key)) { seen.add(key); lines.push(key); }
  });
  return lines;
}

function emit(input, parseMode, rawText) {
  let lines;
  try {
    lines = parseMode === 'partial' ? partialLines(rawText || '') : buildLines(input || {}, parseMode);
  } catch (e) {
    lines = null;
    // A crash while analysing real input still gets the conservative treatment.
    if (rawText && parseMode !== 'partial') {
      try { lines = partialLines(rawText); } catch (x) { lines = null; }
    }
    if (!lines) lines = ['PARSE=error', `ERROR=${flat(e && e.message)}`];
  }
  process.stdout.write(lines.join('\n') + '\n');
}

function main() {
  const argv = process.argv.slice(2);
  const ci = argv.indexOf('--command');
  if (ci !== -1) {
    const cmd = argv.slice(ci + 1).join(' ');
    emit({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: cmd } }, cmd ? 'raw' : 'empty');
    return;
  }
  if (process.stdin.isTTY) { emit({}, 'empty'); return; }

  const chunks = [];
  let done = false;
  const finish = (timedOut) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    const text = Buffer.concat(chunks).toString('utf8');
    process.stdin.destroy();
    if (!text.trim()) {
      // Nothing arrived before the timeout: unknown, not empty. Callers fail closed on error.
      emit({}, timedOut === true ? 'error' : 'empty');
      return;
    }
    if (timedOut === true) { emit(null, 'partial', text); return; }
    let input = null;
    try { input = JSON.parse(text); } catch (e) { input = null; }
    if (input && typeof input === 'object' && !Array.isArray(input)) emit(input, 'json', text);
    else if (/^\s*\{\s*"/.test(text)) emit(null, 'partial', text);
    else emit({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: text.trim() } }, 'raw', text);
  };
  const timer = setTimeout(() => finish(true), STDIN_TIMEOUT_MS);
  process.stdin.on('data', (d) => chunks.push(d));
  process.stdin.on('end', () => finish(false));
  process.stdin.on('error', () => finish(true));
}

process.on('uncaughtException', (e) => {
  try { process.stdout.write(`PARSE=error\nERROR=${flat(e && e.message)}\n`); } catch (x) { /* nothing left to do */ }
  process.exit(0);
});

main();
