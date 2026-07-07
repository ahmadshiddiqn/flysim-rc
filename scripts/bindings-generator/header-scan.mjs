// Scans FGFDMExec.h source text and extracts public method signatures.
// Dependency-free and cross-platform (avoids the multi-hundred-MB clang AST
// dump that libc++ template expansion produces on Windows).

import { readFileSync } from 'node:fs';

/**
 * @param {string} headerPath absolute path to FGFDMExec.h
 * @returns {{name:string, returnType:string, params:{name:string,type:string}[], isConst:boolean, isPureVirtual:boolean}[]}
 */
export function scanFgfdmExec(headerPath) {
  const raw = readFileSync(headerPath, 'utf8');
  const text = stripComments(raw);

  const { body, accessMap } = extractClassBody(text, 'FGFDMExec');
  if (!body) throw new Error(`class FGFDMExec not found in ${headerPath}`);

  // Split the class body into declarations, tracking the access level in effect
  // for each declaration. Inline method bodies { ... } are discarded so the
  // statements inside them are not mistaken for declarations.
  const decls = splitDeclarations(body, accessMap);

  const methods = [];
  for (const { text: decl, access } of decls) {
    if (access !== 'public') continue;
    const m = parseMethodDecl(decl);
    if (m) methods.push(m);
  }
  return methods;
}

function stripComments(src) {
  // Remove /* ... */ (multi-line) and // ... line comments.
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      out += end === -1 ? '' : ' ';
      i = end === -1 ? src.length : end + 2;
    } else if (src[i] === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
    } else {
      out += src[i++];
    }
  }
  return out;
}

// Find the class body and a map of declaration-index -> access level.
// Returns { body: string, accessMap: Map<number,'public'|'private'|'protected'> }
function extractClassBody(text, className) {
  const classRe = new RegExp(`\\bclass\\s+\\w*\\s*${className}\\b`);
  const m = text.match(classRe);
  if (!m) return { body: null, accessMap: null };
  let i = text.indexOf(m[0]);
  // Find the opening brace of the class.
  const openIdx = text.indexOf('{', i);
  if (openIdx === -1) return { body: null, accessMap: null };
  // Brace match to the class closing brace.
  let depth = 0;
  let end = -1;
  for (let j = openIdx; j < text.length; j++) {
    if (text[j] === '{') depth++;
    else if (text[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end === -1) return { body: null, accessMap: null };
  return { body: text.slice(openIdx + 1, end), accessMap: null };
}

// Split the class body into top-level declarations, discarding inline bodies.
// Tracks access labels (public:/private:/protected:) and tags each declaration.
function splitDeclarations(body) {
  const decls = [];
  let buf = '';
  let paren = 0, angle = 0, brace = 0;
  let access = 'private'; // class default
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    // Detect access labels at the class-body level.
    if (paren === 0 && angle === 0 && brace === 0) {
      const rest = body.slice(i);
      let m = rest.match(/^\s*(public|private|protected)\s*:/);
      if (m) {
        access = m[1];
        i += m[0].length;
        buf = '';
        continue;
      }
    }
    if (brace > 0) {
      // Inside an inline body: skip until the matching closing brace.
      if (ch === '{') brace++;
      else if (ch === '}') { brace--; if (brace === 0) { /* body ended */ } }
      i++;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '<') angle++;
    else if (ch === '>') angle = Math.max(0, angle - 1);
    else if (ch === '{') {
      const t = buf.trim();
      if (t && t.includes('(')) decls.push({ text: t, access });
      buf = '';
      brace++;
      i++;
      continue;
    }
    else if (ch === ';' && paren === 0 && angle === 0 && brace === 0) {
      const t = buf.trim();
      if (t) decls.push({ text: t, access });
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  return decls;
}

function parseMethodDecl(decl) {
  // A method declaration looks like:  <returnType> <name>(<params>) [const] [= 0]
  // (constructors have no return type; destructors start with ~; we skip both).
  const openParen = indexOfTopLevel(decl, '(');
  if (openParen === -1) return null; // not a method (member var / enum / etc.)

  const left = decl.slice(0, openParen).trim();
  const closeParen = matchParen(decl, openParen);
  const paramText = decl.slice(openParen + 1, closeParen);
  const after = decl.slice(closeParen + 1).trim();

  const isConst = /\bconst\b/.test(after);
  const isPureVirtual = /=(\s*)0\b/.test(after) || /\bpure\b/.test(after);

  // The method name is the last identifier token in `left`.
  const nameMatch = left.match(/([A-Za-z_]\w*)\s*$/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const returnType = left.slice(0, nameMatch.index).trim();

  if (name === 'FGFDMExec') return null; // constructor
  if (name.startsWith('~')) return null; // destructor
  if (!returnType) return null; // constructor or operator — skip
  // Skip operators (operator+, operator(), etc.)
  if (name.startsWith('operator')) return null;

  const params = parseParams(paramText);
  return { name, returnType, params, isConst, isPureVirtual };
}

function indexOfTopLevel(s, ch) {
  let p = 0, a = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ch && p === 0 && a === 0) return i;
    if (s[i] === '(') p++;
    else if (s[i] === ')') p--;
    else if (s[i] === '<') a++;
    else if (s[i] === '>') a = Math.max(0, a - 1);
  }
  return -1;
}

function matchParen(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return s.length - 1;
}

function parseParams(text) {
  const t = text.trim();
  if (!t || t === 'void') return [];
  const parts = splitTopLevel(t, ',');
  return parts.map(part => {
    let p = part.trim();
    // Strip default value `= ...`
    const eq = indexOfTopLevel(p, '=');
    if (eq !== -1) p = p.slice(0, eq).trim();
    // The param name is the last identifier; the type is the rest.
    const nm = p.match(/([A-Za-z_]\w*)\s*$/);
    const name = nm ? nm[1] : '';
    const type = nm ? p.slice(0, nm.index).trim() : p;
    return { name, type: normalizeType(type) };
  }).filter(p => p.type.length > 0);
}

function splitTopLevel(s, sep) {
  const out = [];
  let buf = '', p = 0, a = 0, b = 0;
  for (const ch of s) {
    if (ch === '(') p++;
    else if (ch === ')') p--;
    else if (ch === '<') a++;
    else if (ch === '>') a = Math.max(0, a - 1);
    else if (ch === '[') b++;
    else if (ch === ']') b = Math.max(0, b - 1);
    else if (ch === sep && p === 0 && a === 0 && b === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function normalizeType(t) {
  return t.replace(/\s+/g, ' ').trim();
}
