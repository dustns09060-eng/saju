'use strict';

/**
 * 쉬운 용어 풀이.
 *  - glossary.attach(rootEl): 이미 렌더된 글 안에서 명리/타로 용어의 "첫 등장"을 밑줄 버튼으로 바꾼다.
 *  - 버튼을 누르면 작은 말풍선으로 한 줄 뜻을 보여준다.
 *  - 표(원국표) 안은 건드리지 않는다. 풀이 본문·인사문에만 적용.
 */
(function () {
  const TERMS = {
    '사주팔자': '태어난 연·월·일·시를 두 글자씩 나타낸 여덟 글자. 타고난 기운의 지도.',
    '원국': '사주 여덟 글자를 표로 정리한 것. 나의 기본 판.',
    '일간': "태어난 '날'의 첫 글자. 사주에서 '나 자신'을 뜻함.",
    '천간': '간지의 위 글자(갑·을·병…). 겉으로 드러나는 기운.',
    '지지': '간지의 아래 글자(자·축·인…). 땅·현실의 기운.',
    '지장간': '지지 속에 숨어 있는 천간. 속마음·잠재된 기운.',
    '오행': '목·화·토·금·수 다섯 기운. 많고 적음으로 성향과 보완점을 봄.',
    '십성': '일간과의 관계로 나눈 열 가지 역할(비겁·식상·재성·관성·인성).',
    '비겁': '나와 같은 편의 기운. 자립심·경쟁·동료.',
    '식상': '내가 만들어 내보내는 기운. 표현·재주·활동.',
    '재성': '내가 다루는 기운. 돈·현실 성과·이성(남자 사주).',
    '관성': '나를 규율하는 기운. 직책·규범·이성(여자 사주).',
    '인성': '나를 돕고 채우는 기운. 공부·문서·보살핌.',
    '용신': '나에게 가장 도움이 되는 기운. 방향·색·습관의 기준.',
    '희신': '용신을 돕는 기운.',
    '기신': '지금 나에게 부담이 되는 기운.',
    '신강': '일간이 힘이 센 상태. 밀어붙이는 힘이 강함.',
    '신약': '일간이 힘이 약한 상태. 도움과 채움이 필요함.',
    '대운': '10년마다 바뀌는 큰 흐름.',
    '세운': '그해 한 해의 흐름.',
    '십이운성': '기운이 태어나 자라고 스러지는 12단계(장생·제왕·묘…).',
    '신살': '특정 글자 조합에 붙는 상징적 표식(도화·역마·화개 등).',
    '공망': '비어 있는 것으로 보는 자리. 채워지기 어렵거나 초연한 영역.',
    '도화': '매력·인기·이성 인연과 관련된 신살.',
    '역마': '이동·변화·여행과 관련된 신살.',
    '화개': '예술·종교·고독·연구와 관련된 신살.',
    '조후': '사주의 계절적 춥고 더움의 균형.',
    '충': '두 글자가 부딪쳐 흔들리는 관계.',
    '합': '두 글자가 묶여 성질이 바뀌는 관계.',
  };

  const keys = Object.keys(TERMS).sort((a, b) => b.length - a.length);

  let pop;
  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'term-pop';
    pop.hidden = true;
    document.body.appendChild(pop);
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !e.target.closest('.term') && !e.target.closest('.term-pop')) pop.hidden = true;
    });
    window.addEventListener('resize', () => (pop.hidden = true));
    window.addEventListener('scroll', () => (pop.hidden = true), true);
    return pop;
  }

  function openPop(btn) {
    const p = ensurePop();
    p.textContent = btn.dataset.def || '';
    p.hidden = false;
    const r = btn.getBoundingClientRect();
    const w = Math.min(260, window.innerWidth - 24);
    p.style.width = w + 'px';
    let left = r.left + r.width / 2 - w / 2 + window.scrollX;
    left = Math.max(12 + window.scrollX, Math.min(left, window.scrollX + window.innerWidth - w - 12));
    p.style.left = left + 'px';
    p.style.top = r.bottom + window.scrollY + 6 + 'px';
  }

  function attach(root) {
    if (!root) return;
    const seen = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest('.term, .term-pop, h2, h3, code, a, button')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);

    for (const text of targets) {
      let value = text.nodeValue;
      for (const k of keys) {
        if (seen.has(k)) continue;
        const i = value.indexOf(k);
        if (i < 0) continue;
        // 이미 괄호로 풀이가 붙어 있으면(예: "식상(食傷 — …)") 건너뜀
        if (value[i + k.length] === '(' || value[i + k.length] === '（') { seen.add(k); continue; }
        const after = text.splitText(i);
        after.nodeValue = after.nodeValue.slice(k.length);
        const btn = document.createElement('button');
        btn.className = 'term';
        btn.type = 'button';
        btn.textContent = k;
        btn.dataset.def = TERMS[k];
        btn.addEventListener('click', (e) => { e.stopPropagation(); openPop(btn); });
        after.parentNode.insertBefore(btn, after);
        seen.add(k);
        break; // 이 텍스트 노드는 한 번만 처리하고 다음으로
      }
    }
  }

  window.glossary = { TERMS, attach };
})();
