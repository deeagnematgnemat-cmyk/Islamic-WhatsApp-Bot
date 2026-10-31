// تصحيح ثغرات الربط بالكود في Baileys (مصدر الإصلاح: WhiskeySockets/Baileys PR #2872).
// يعمل تلقائياً بعد npm install (postinstall) ولا يوقف التثبيت أبداً حتى لو فشل.
import fs from 'fs';
import path from 'path';
import cp from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, 'node_modules', '@whiskeysockets', 'baileys', 'lib');
const log = (m) => console.log('[patch-baileys] ' + m);

function walk(dir, out = []) {
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    for (const e of list) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (/\.(js|cjs|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
}

function syntaxOk(file) {
    try { cp.execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); return true; } catch (e) { return false; }
}

function applyPatch(file, name, transform) {
    const src = fs.readFileSync(file, 'utf8');
    const out = transform(src);
    if (out === null) return 'skip';
    if (out === src) return 'nochange';
    fs.writeFileSync(file + '.orig-pairfix', src);
    fs.writeFileSync(file, out);
    if (!syntaxOk(file)) {
        fs.writeFileSync(file, src);
        fs.unlinkSync(file + '.orig-pairfix');
        return 'reverted';
    }
    return 'patched';
}

// 1) nonce الربط: واتساب يرفض '0' (بايت 0x30) ويريد بايت صفري 0x00
const NONCE_RE = /(link_code_pairing_nonce['"]\s*,\s*attrs\s*:\s*\{\s*\}\s*,\s*content\s*:\s*)(['"])0\2/;
const NONCE_FIXED_RE = /link_code_pairing_nonce['"]\s*,\s*attrs\s*:\s*\{\s*\}\s*,\s*content\s*:\s*(Buffer\.from\(\[0\]\)|Buffer\.alloc\(1\)|new Uint8Array\(1\))/;

// 2) الإشعار الأول بلا stage لا يحمل مفاتيح التشفير: نتجاهله ونعالج primary_hello فقط
const CASE_RE = /(case\s+['"]link_code_companion_reg['"]\s*:\s*\{?)/;
const GUARD_MARK = '/*pairfix-stage*/';
const GUARD = ` ${GUARD_MARK} { const __lcn = Array.isArray(node && node.content) ? node.content.find((c) => c && c.tag === 'link_code_companion_reg') : undefined; if (!__lcn || !__lcn.attrs || __lcn.attrs.stage !== 'primary_hello') { break; } } `;

const status = { nonce: 'not-found', stage: 'not-found' };

try {
    const files = walk(ROOT);
    if (!files.length) { log('لم أجد مجلد Baileys، تخطّي.'); }
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf8');
        if (text.includes('link_code_pairing_nonce')) {
            if (NONCE_FIXED_RE.test(text)) { status.nonce = 'already-ok'; }
            else {
                const r = applyPatch(f, 'nonce', (s) => NONCE_RE.test(s) ? s.replace(NONCE_RE, '$1Buffer.from([0])') : null);
                if (r !== 'skip') status.nonce = r;
                log(`nonce @ ${path.relative(ROOT, f)}: ${r}`);
            }
        }
        if (text.includes('primary_identity_pub') && CASE_RE.test(text)) {
            if (text.includes(GUARD_MARK)) { status.stage = 'already-ok'; }
            else {
                const r = applyPatch(f, 'stage', (s) => CASE_RE.test(s) ? s.replace(CASE_RE, (m) => m + GUARD) : null);
                if (r !== 'skip') status.stage = r;
                log(`stage-check @ ${path.relative(ROOT, f)}: ${r}`);
            }
        }
    }
} catch (e) {
    log('تعذر التصحيح: ' + (e && e.message));
}
log('النتيجة: ' + JSON.stringify(status));
process.exit(0);
