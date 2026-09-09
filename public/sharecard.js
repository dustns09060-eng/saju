'use strict';

/* 공유용 결과 카드 이미지 생성 (canvas, 의존성 없음).
 * window.makeSajuCard({ chart, reading, topics, url }) → Promise<{ blob, dataUrl }>
 *   topics: [{ emoji, label }]
 */
(function () {
  const W = 1080, H = 1350;
  const EL_COL = {
    목: ['#7fc99b', '#3f7d5c'], 화: ['#e88a8a', '#a24b4b'],
    토: ['#d8b45a', '#977528'], 금: ['#c9cede', '#7c8290'], 수: ['#79b4e6', '#3f6fa0'],
  };
  const EL_ORDER = ['목', '화', '토', '금', '수'];
  const FONT = 'Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const SERIF = '"Nanum Myeongjo", Pretendard, serif';
  const C = { bg0: '#0a0e1e', bg1: '#1b2450', panel: '#161d3a', line: 'rgba(216,180,90,0.3)', gold: '#e8cd8b', ink: '#ece9f5', muted: '#9aa0c0' };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
        if (lines.length === maxLines - 1) break;
      } else {
        cur = t;
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines) {
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }

  function pickSummary(reading) {
    if (!reading) return '';
    const lines = reading.replace(/\r/g, '').split('\n');
    let buf = [];
    let i = lines.findIndex((l) => /^###\s/.test(l) && /종합/.test(l));
    if (i >= 0) {
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j].trim();
        if (/^###\s/.test(l) || /^[—-]{1,2}\s/.test(l)) break;
        if (l) buf.push(l);
      }
    }
    if (!buf.length) {
      const k = lines.findIndex((l) => /^###\s/.test(l));
      for (let j = k + 1; j < lines.length && buf.length < 2; j++) {
        const l = lines[j].trim();
        if (/^###\s/.test(l)) break;
        if (l) buf.push(l);
      }
    }
    let s = buf.join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (s.length > 130) {
      s = s.slice(0, 130);
      const cut = Math.max(s.lastIndexOf('다.'), s.lastIndexOf('. '), s.lastIndexOf('요.'));
      if (cut > 60) s = s.slice(0, cut + 2);
      else s = s.trim() + '…';
    }
    return s;
  }

  async function makeSajuCard({ chart, reading, topics, url, siteName }) {
    const SITE = siteName || '별헤는밤';
    try {
      await Promise.all([
        document.fonts.load('800 48px Pretendard'),
        document.fonts.load('700 34px Pretendard'),
        document.fonts.load('400 30px Pretendard'),
      ]);
      await document.fonts.ready;
    } catch {}

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    // 배경 (밤하늘)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.bg1);
    bg.addColorStop(1, C.bg0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // 별
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % W, sy = (i * 89.3) % H;
      ctx.globalAlpha = 0.2 + ((i * 7) % 10) / 14;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    // 달
    const mg = ctx.createRadialGradient(W - 150, 150, 10, W - 150, 150, 90);
    mg.addColorStop(0, '#fff8e6'); mg.addColorStop(0.6, '#e8cd8b'); mg.addColorStop(1, 'rgba(183,144,47,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(W - 150, 150, 90, 0, Math.PI * 2); ctx.fill();

    // 패널
    ctx.fillStyle = C.panel;
    rr(ctx, 48, 48, W - 96, H - 96, 40);
    ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    rr(ctx, 48, 48, W - 96, H - 96, 40);
    ctx.stroke();

    const PAD = 100;
    const innerW = W - PAD * 2;
    let y = 150;

    // 헤더
    ctx.fillStyle = C.gold;
    ctx.font = '400 30px ' + SERIF;
    ctx.fillText(SITE + ' · 별빛 아래 사주', PAD, y);
    y += 66;

    const dm = chart.dayMaster;
    const ys = chart.yongsin || {};
    ctx.fillStyle = C.gold;
    ctx.font = '800 58px ' + SERIF;
    ctx.fillText(`일간 ${dm.stem}${dm.element} (${dm.yinYang})`, PAD, y);
    y += 46;
    ctx.fillStyle = C.muted;
    ctx.font = '400 28px ' + FONT;
    const inp = chart.input || {};
    const cal = inp.calendar === 'lunar' ? '음력' : '양력';
    ctx.fillText(`${cal} ${inp.year}.${inp.month}.${inp.day} · ${inp.gender === 'female' ? '여성' : '남성'} · ${ys.level || ''}`, PAD, y);
    y += 56;

    // 사주팔자 4기둥
    const keys = ['year', 'month', 'day', 'hour'].filter((k) => chart.pillars[k]);
    const gap = 20;
    const pw = (innerW - gap * (keys.length - 1)) / keys.length;
    const ph = 240;
    const labels = { year: '년주', month: '월주', day: '일주', hour: '시주' };
    keys.forEach((k, idx) => {
      const p = chart.pillars[k];
      const px = PAD + idx * (pw + gap);
      const col = EL_COL[p.element.branch] || EL_COL['토'];
      const g = ctx.createLinearGradient(px, y, px, y + ph);
      g.addColorStop(0, col[0]);
      g.addColorStop(1, col[1]);
      ctx.fillStyle = g;
      rr(ctx, px, y, pw, ph, 26);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = '700 24px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(labels[k], px + pw / 2, y + 44);
      ctx.fillStyle = '#fff';
      ctx.font = '800 62px ' + SERIF;
      ctx.fillText(p.stem, px + pw / 2, y + 120);
      ctx.fillText(p.branch, px + pw / 2, y + 194);
      ctx.textAlign = 'left';
    });
    y += ph + 60;

    // 오행 막대 (가중비율)
    ctx.fillStyle = C.muted;
    ctx.font = '700 26px ' + FONT;
    ctx.fillText('오행 균형', PAD, y);
    y += 24;
    const rt = (chart.yongsin && chart.yongsin.ratio) || null;
    const v = chart.elements.visible;
    const val = (e) => (rt ? rt[e] : v[e]);
    const maxV = Math.max(...EL_ORDER.map((e) => val(e)), 1);
    const bw = (innerW - gap * 4) / 5;
    EL_ORDER.forEach((e, idx) => {
      const bx = PAD + idx * (bw + gap);
      const bh = 70;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      rr(ctx, bx, y, bw, bh, 18);
      ctx.fill();
      const col = EL_COL[e];
      const g = ctx.createLinearGradient(bx, y, bx + bw, y);
      g.addColorStop(0, col[0]);
      g.addColorStop(1, col[1]);
      ctx.fillStyle = g;
      ctx.globalAlpha = val(e) === 0 ? 0.2 : 0.4 + 0.6 * (val(e) / maxV);
      rr(ctx, bx, y, bw, bh, 18);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0b1020';
      ctx.font = '800 26px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(rt ? `${e}` : `${e}${v[e]}`, bx + bw / 2, y + 44);
      ctx.textAlign = 'left';
    });
    y += 70 + 64;

    // 주제 칩
    if (topics && topics.length) {
      let cx = PAD;
      const chy = y;
      ctx.font = '700 24px ' + FONT;
      topics.slice(0, 6).forEach((t) => {
        const txt = `${t.emoji} ${t.label}`;
        const tw = ctx.measureText(txt).width + 36;
        if (cx + tw > PAD + innerW) return;
        ctx.fillStyle = 'rgba(216,180,90,0.12)';
        rr(ctx, cx, chy - 30, tw, 46, 23);
        ctx.fill();
        ctx.fillStyle = C.gold;
        ctx.fillText(txt, cx + 18, chy + 1);
        cx += tw + 10;
      });
      y += 56;
    }

    // 종합 요약
    const summary = pickSummary(reading);
    if (summary) {
      const boxTop = y;
      ctx.font = '400 31px ' + SERIF;
      const sl = wrap(ctx, summary, innerW - 56, 4);
      const boxH = 40 + sl.length * 46 + 24;
      ctx.fillStyle = 'rgba(216,180,90,0.08)';
      rr(ctx, PAD, boxTop, innerW, boxH, 20);
      ctx.fill();
      ctx.fillStyle = C.ink;
      sl.forEach((ln, i) => ctx.fillText(ln, PAD + 28, boxTop + 60 + i * 46));
      y = boxTop + boxH + 40;
    }

    // 푸터
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, H - 150);
    ctx.lineTo(W - PAD, H - 150);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.font = '800 30px ' + SERIF;
    const host = (url || location.host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    ctx.fillText(SITE + ' 사주', PAD, H - 104);
    ctx.fillStyle = C.muted;
    ctx.font = '400 25px ' + FONT;
    ctx.fillText((host ? host + '  ·  ' : '') + '참고와 위로를 위한 사주', PAD, H - 66);

    const dataUrl = cv.toDataURL('image/png');
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png', 0.95));
    return { blob, dataUrl };
  }

  window.makeSajuCard = makeSajuCard;
})();
