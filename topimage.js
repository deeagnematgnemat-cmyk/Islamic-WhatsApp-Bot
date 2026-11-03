// صورة ترتيب التفاعل (أول 50) لأمر .توب_التفاعل — تصميم Eren Bot
const FONT = "DejaVu Sans, Noto Sans Arabic, Arial, Helvetica, sans-serif";

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// الإيموجي والرموز الزخرفية لا تُرسم في SVG (تظهر مربعات) فنحذفها ونبقي الحروف والأرقام
function cleanName(name, fallback) {
    let n = String(name || '')
        .replace(/[\p{Extended_Pictographic}\u200d\ufe0f\u20e3]/gu, '')
        .replace(/[\u0000-\u001f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!n) n = fallback;
    if (n.length > 18) n = n.slice(0, 17) + '…';
    return n;
}

export function buildTopSvg({ entries, totalMsgs, periodTitle, periodSub, memberCount }) {
    const W = 1080;
    const ROW = 46;
    const TOP = 262;
    const rows = entries.slice(0, 50);
    const H = TOP + Math.max(rows.length, 1) * ROW + 96;
    const max = rows.length ? rows[0].count : 1;
    const BAR_X = 410;
    const BAR_MAX = 520;

    const medal = ['#f4c430', '#cfd4da', '#cd7f32'];
    let body = '';
    rows.forEach((r, i) => {
        const y = TOP + i * ROW;
        const bw = Math.max(10, Math.round(BAR_MAX * (r.count / max)));
        const fill = i < 3 ? medal[i] : 'url(#bar)';
        const numFill = i < 3 ? medal[i] : '#e9c9cf';
        if (i % 2 === 0) body += `<rect x="28" y="${y - 4}" width="${W - 56}" height="${ROW - 4}" rx="10" fill="#ffffff" fill-opacity="0.035"/>`;
        body += `<text x="92" y="${y + 26}" font-family="${FONT}" font-size="25" font-weight="bold" fill="${numFill}" text-anchor="end">${String(i + 1).padStart(2, '0')}</text>`;
        body += `<text x="118" y="${y + 26}" font-family="${FONT}" font-size="25" fill="#f7eaec">${esc(r.name)}</text>`;
        body += `<rect x="${BAR_X}" y="${y + 3}" width="${bw}" height="26" rx="13" fill="${fill}"/>`;
        body += `<text x="${BAR_X + bw + 14}" y="${y + 26}" font-family="${FONT}" font-size="24" font-weight="bold" fill="${i < 3 ? medal[i] : '#ffffff'}">${r.count}</text>`;
    });
    if (!rows.length) body = `<text x="${W / 2}" y="${TOP + 40}" font-family="${FONT}" font-size="28" fill="#e9c9cf" text-anchor="middle">NO ACTIVITY RECORDED</text>`;

    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0a12"/><stop offset="0.5" stop-color="#14070b"/><stop offset="1" stop-color="#1c0810"/></linearGradient>
<linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a1230"/><stop offset="1" stop-color="#e03a5a"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6d1a"/><stop offset="0.5" stop-color="#f4d35e"/><stop offset="1" stop-color="#8a6d1a"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="26" fill="none" stroke="url(#gold)" stroke-width="3"/>
<rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="18" fill="none" stroke="#e03a5a" stroke-opacity="0.35" stroke-width="1.5"/>
<text x="${W / 2}" y="98" font-family="${FONT}" font-size="58" font-weight="bold" fill="#f4d35e" text-anchor="middle" letter-spacing="8">EREN BOT</text>
<rect x="${W / 2 - 170}" y="116" width="340" height="3" rx="1.5" fill="url(#gold)"/>
<text x="${W / 2}" y="168" font-family="${FONT}" font-size="34" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="3">TOP 50 ACTIVITY</text>
<text x="${W / 2}" y="206" font-family="${FONT}" font-size="24" fill="#e9c9cf" text-anchor="middle">${esc(periodTitle)}  •  ${esc(periodSub)}</text>
<text x="${W / 2}" y="238" font-family="${FONT}" font-size="22" fill="#e03a5a" text-anchor="middle">${totalMsgs} MESSAGES  •  ${rows.length} / ${memberCount} MEMBERS ACTIVE</text>
${body}
<text x="${W / 2}" y="${H - 44}" font-family="${FONT}" font-size="20" fill="#8a6d1a" text-anchor="middle" letter-spacing="4">EREN BOT</text>
</svg>`;
}

// entries: [{ id, count }]  —  names: { jid: pushName }
export async function buildTopImage({ entries, names, totalMsgs, periodTitle, periodSub, memberCount }) {
    const sharp = (await import('sharp')).default;
    const list = entries.map((e) => ({
        count: e.count,
        name: cleanName(names?.[e.id], String(e.id).split('@')[0].split(':')[0]),
    }));
    const svg = buildTopSvg({ entries: list, totalMsgs, periodTitle, periodSub, memberCount });
    return await sharp(Buffer.from(svg)).png().toBuffer();
}
