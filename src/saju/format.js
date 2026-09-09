'use strict';

/**
 * computeChart() 결과 → Claude 프롬프트에 넣을 압축 한국어 텍스트.
 * (숫자·간지는 서버에서 확정한 값이므로 AI 가 다시 계산하지 않도록 명확히 제시한다.)
 */

const POS_LABEL = { year: '연주', month: '월주', day: '일주', hour: '시주' };

function fmtPillars(chart) {
  const lines = [];
  for (const k of ['year', 'month', 'day', 'hour']) {
    const p = chart.pillars[k];
    if (!p) continue;
    const tg = chart.tenGods[k];
    const hidden = p.hidden.map((h) => h.stem).join('·');
    const self = k === 'day' ? ' (일간)' : '';
    lines.push(
      `- ${POS_LABEL[k]}: ${p.ganjiKorean}(${p.ganjiHanja})${self} / 천간 ${p.stem}(${p.element.stem}) 십신 ${tg.stem} / 지지 ${p.branch}(${p.element.branch}) 십신 ${tg.branch} / 지장간 ${hidden}`
    );
  }
  return lines.join('\n');
}

function fmtElements(chart) {
  const v = chart.elements.visible;
  const order = ['목', '화', '토', '금', '수'];
  const counts = order.map((e) => `${e}${v[e]}`).join(' ');
  const parts = [`드러난 8글자 기준: ${counts}`];
  parts.push(`가장 많음: ${chart.elements.strongest.join(', ')}`);
  parts.push(`가장 적음: ${chart.elements.weakest.join(', ')}`);
  if (chart.elements.absent.length) parts.push(`아예 없음: ${chart.elements.absent.join(', ')}`);
  const h = chart.elements.withHidden;
  parts.push(`지장간 포함 시: ${order.map((e) => `${e}${h[e]}`).join(' ')}`);
  return parts.join('\n');
}

function fmtStrength(chart) {
  const s = chart.dayMasterStrength;
  return `일간 강약(근사 지표, 참고용): ${s.label} — 비겁 ${s.category.비겁}, 인성 ${s.category.인성} (일간을 돕는 힘 ${s.support}) vs 식상 ${s.category.식상}, 재성 ${s.category.재성}, 관성 ${s.category.관성} (일간의 힘을 빼는 요소 ${s.oppose}). 최종 강약 판단은 월령·조후를 함께 고려해 직접 하세요.`;
}

function fmtLuck(chart) {
  if (!chart.luck) return '대운: (성별 미입력으로 계산하지 않음)';
  const dir = chart.luck.forward ? '순행' : '역행';
  const head = `대운: ${chart.luck.startAge}세부터 시작, ${dir}. 현재 만 ${chart.luck.currentAge}세 → 현재 대운: ${
    chart.luck.current ? `${chart.luck.current.ganjiKorean}(${chart.luck.current.age}~${chart.luck.current.age + 9}세)` : '(대운 시작 전)'
  }`;
  const list = chart.luck.pillars
    .map((lp, i) => `${lp.age}세 ${lp.ganjiKorean}${i === chart.luck.currentIndex ? ' ←현재' : ''}`)
    .join(' / ');
  return `${head}\n  ${list}`;
}

function fmtSeun(chart) {
  const c = chart.annualLuck.current;
  const note = c.isBeforeIpchun ? ' (아직 입춘 전이라 전년도 간지 적용)' : '';
  const list = chart.annualLuck.list.map((s) => `${s.year} ${s.korean}${s.isCurrent ? ' ←올해' : ''}`).join(' / ');
  return `세운: 올해 적용 간지 ${c.korean}${note}\n  ${list}`;
}

function fmtSibiunseong(chart) {
  if (!chart.sibiunseong) return '';
  const s = chart.sibiunseong;
  return ['년', '월', '일', '시'].map((L, i) => {
    const k = ['year', 'month', 'day', 'hour'][i];
    return s[k] ? `${L} ${s[k].name}` : null;
  }).filter(Boolean).join(' / ');
}

function fmtSinsal(chart) {
  if (!chart.sinsal) return '';
  const s = chart.sinsal;
  const per = ['년', '월', '일', '시'].map((L, i) => {
    const k = ['year', 'month', 'day', 'hour'][i];
    if (!s.perPillar[k]) return null;
    const extra = s.specialByPillar[k] ? ` +${s.specialByPillar[k].join('·')}` : '';
    return `${L} ${s.perPillar[k].name}${extra}`;
  }).filter(Boolean).join(' / ');
  const pairs = s.pairs.length ? `\n  지지쌍: ${s.pairs.map((p) => `${p.type}(${p.at})`).join(', ')}` : '';
  return per + pairs;
}

function fmtGwiin(chart) {
  if (!chart.gwiin || !chart.gwiin.summary.length) return '없음';
  const per = Object.entries(chart.gwiin.perPillar)
    .map(([k, arr]) => `${({ year: '년', month: '월', day: '일', hour: '시' })[k]} ${arr.join('·')}`)
    .join(' / ');
  return per || chart.gwiin.summary.join(', ');
}

function fmtYongsin(chart) {
  const y = chart.yongsin;
  if (!y) return '';
  const order = ['목', '화', '토', '금', '수'];
  const ratio = order.map((e) => `${e} ${y.ratio[e]}%(${y.ratioLabel[e]})`).join(' / ');
  return [
    `오행 가중비율: ${ratio}`,
    `신강신약: ${y.score}점 → ${y.level} (득령 ${y.deukryeong ? 'O' : 'X'}, 득지 ${y.deukji ? 'O' : 'X'})`,
    `용신 ${y.yongsin} / 희신 ${y.huisin} / 기신 ${y.gisin}  [${y.method}]`,
    y.johuNeed ? `조후상 필요한 기운: ${y.johuNeed}${y.johuApplied ? ' (부족이 심해 용신에 반영)' : ''}` : '',
    `※ ${y.note}`,
  ].filter(Boolean).join('\n');
}

function fmtWealth(chart) {
  if (!chart.wealth) return '';
  const pts = chart.wealth.points
    .map((p) => `${p.age}~${p.endAge}세(${p.ganji}) ${p.score}점 ${p.label}${p.current ? ' ←현재' : ''}`)
    .join('\n  ');
  const peak = chart.wealth.peak ? `\n  가장 높은 시기: ${chart.wealth.peak.age}~${chart.wealth.peak.endAge}세(${chart.wealth.peak.ganji})` : '';
  return `대운별 재물운 지표(0~100, 참고용):\n  ${pts}${peak}`;
}

/** chart → 프롬프트 본문에 삽입할 텍스트 블록 */
function formatChartForPrompt(chart) {
  const i = chart.input;
  const cal = i.calendar === 'lunar' ? `음력${i.isLeapMonth ? ' 윤달' : ''}` : '양력';
  const timeStr = i.hourKnown ? `${String(i.hour).padStart(2, '0')}:${String(i.minute).padStart(2, '0')}` : '시각 모름';
  const tst = i.trueSolarTime ? `적용(경도 ${i.trueSolarTime.longitude})` : '미적용';
  const solar = chart.solarDate ? `${chart.solarDate.year}-${chart.solarDate.month}-${chart.solarDate.day}` : '(변환 불가)';

  return [
    '# 사주 원국 데이터 (서버에서 만세력 라이브러리로 확정한 값)',
    '',
    `- 입력: ${cal} ${i.year}년 ${i.month}월 ${i.day}일 ${timeStr}${i.place ? ` / 출생지 ${i.place}` : ''}`,
    `- 양력 환산일: ${solar}`,
    `- 성별: ${i.gender === 'male' ? '남' : i.gender === 'female' ? '여' : '미입력'}`,
    `- 진태양시 보정: ${tst}`,
    `- 일 경계 기준: ${i.dayBoundary}`,
    '',
    '## 사주팔자 (네 기둥)',
    fmtPillars(chart),
    '',
    '## 오행 분포',
    fmtElements(chart),
    '',
    '## 일간',
    `일간(나): ${chart.dayMaster.stem} — 오행 ${chart.dayMaster.element}, 음양 ${chart.dayMaster.yinYang}`,
    '',
    '## 공망(空亡)',
    (chart.voidBranches && chart.voidBranches.length ? chart.voidBranches.join(', ') : '없음'),
    '',
    '## 십이운성 (일간 기준, 년/월/일/시)',
    fmtSibiunseong(chart),
    '',
    '## 신살 (년지 삼합국 기준 12신살 + 특수신살)',
    fmtSinsal(chart),
    '',
    '## 귀인·길신',
    fmtGwiin(chart),
    '',
    '## 신강신약 · 오행비율 · 용신',
    fmtYongsin(chart),
    '',
    '## 대운(大運)',
    fmtLuck(chart),
    '',
    '## 시기별 재물운 (대운 기준)',
    fmtWealth(chart),
    '',
    '## 세운(歲運)',
    fmtSeun(chart),
    chart.warnings && chart.warnings.length ? `\n## 참고\n- ${chart.warnings.join('\n- ')}` : '',
  ].join('\n');
}

module.exports = { formatChartForPrompt };
