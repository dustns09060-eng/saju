'use strict';

/**
 * 라이더-웨이트 78장 덱.
 *  - 그림 파일 없이 CSS/SVG 미니멀 카드로 렌더하므로, 여기엔 "정체성"만 담는다.
 *  - id: 안정적인 키. ko/en: 이름. roman: 카드에 새길 글자. glyph: 미니 SVG 심볼 키(styles/app 에서 사용).
 *  - up / rev: 정방향/역방향 키워드(2~4개). AI 해석의 근거로만 쓰이고 화면엔 일부만 노출.
 *  - arcana: 'major' | 'minor', suit: 'wands'|'cups'|'swords'|'pentacles'|null
 */

const MAJORS = [
  ['fool', '바보', 'The Fool', '0', 'star', ['시작', '자유', '순수', '모험'], ['무모함', '방향 상실', '경솔']],
  ['magician', '마법사', 'The Magician', 'I', 'wand', ['의지', '재능', '실행력', '집중'], ['조작', '재능 낭비', '자신감 부족']],
  ['priestess', '여사제', 'The High Priestess', 'II', 'moon', ['직관', '내면', '비밀', '잠재력'], ['혼란', '외면한 진실', '감정 억압']],
  ['empress', '여황제', 'The Empress', 'III', 'leaf', ['풍요', '돌봄', '창조', '결실'], ['정체', '과보호', '자기돌봄 부족']],
  ['emperor', '황제', 'The Emperor', 'IV', 'shield', ['안정', '질서', '책임', '리더십'], ['경직', '통제욕', '고집']],
  ['hierophant', '교황', 'The Hierophant', 'V', 'key', ['전통', '가르침', '소속', '신뢰'], ['형식주의', '반항', '틀에 갇힘']],
  ['lovers', '연인', 'The Lovers', 'VI', 'heart', ['사랑', '선택', '가치관', '결합'], ['갈등', '유혹', '어긋난 선택']],
  ['chariot', '전차', 'The Chariot', 'VII', 'wheel', ['전진', '의지', '승리', '통제'], ['조급함', '방향 없음', '좌절']],
  ['strength', '힘', 'Strength', 'VIII', 'flame', ['용기', '부드러운 힘', '인내', '자기다스림'], ['자기의심', '조바심', '소진']],
  ['hermit', '은둔자', 'The Hermit', 'IX', 'lantern', ['성찰', '고독', '지혜', '탐구'], ['고립', '회피', '외로움']],
  ['wheel', '운명의 수레바퀴', 'Wheel of Fortune', 'X', 'wheel', ['전환점', '흐름', '기회', '순환'], ['지연', '악순환', '통제 밖의 변화']],
  ['justice', '정의', 'Justice', 'XI', 'scale', ['균형', '공정', '결과', '책임'], ['불공정', '회피', '편향']],
  ['hanged', '매달린 사람', 'The Hanged Man', 'XII', 'drop', ['멈춤', '관점 전환', '내려놓음', '기다림'], ['정체', '헛된 희생', '고집']],
  ['death', '죽음', 'Death', 'XIII', 'scythe', ['끝맺음', '변형', '재생', '정리'], ['집착', '변화 거부', '늘어지는 마무리']],
  ['temperance', '절제', 'Temperance', 'XIV', 'drop', ['조화', '중용', '치유', '인내'], ['불균형', '과함', '조급']],
  ['devil', '악마', 'The Devil', 'XV', 'chain', ['집착', '유혹', '속박', '욕망'], ['해방', '자각', '끊어냄']],
  ['tower', '탑', 'The Tower', 'XVI', 'bolt', ['갑작스러운 변화', '붕괴', '각성', '해방'], ['간신히 피함', '두려움에 붙듦', '지연된 충격']],
  ['star', '별', 'The Star', 'XVII', 'star', ['희망', '회복', '영감', '평온'], ['실망', '자신감 상실', '메마름']],
  ['moon', '달', 'The Moon', 'XVIII', 'moon', ['불안', '무의식', '착각', '직관'], ['혼란 해소', '진실 드러남', '두려움 극복']],
  ['sun', '태양', 'The Sun', 'XIX', 'sun', ['성공', '활력', '기쁨', '명료함'], ['지연된 기쁨', '과신', '들뜸']],
  ['judgement', '심판', 'Judgement', 'XX', 'horn', ['부름', '재평가', '용서', '전환'], ['자기비판', '망설임', '과거에 묶임']],
  ['world', '세계', 'The World', 'XXI', 'wheel', ['완성', '성취', '통합', '여정의 끝'], ['미완', '마무리 지연', '아쉬움']],
];

const SUITS = {
  wands: { ko: '완드', en: 'Wands', el: '불', theme: ['열정', '일', '추진력', '창의'] },
  cups: { ko: '컵', en: 'Cups', el: '물', theme: ['감정', '관계', '마음', '직관'] },
  swords: { ko: '소드', en: 'Swords', el: '바람', theme: ['생각', '갈등', '판단', '말'] },
  pentacles: { ko: '펜타클', en: 'Pentacles', el: '흙', theme: ['현실', '돈', '몸', '결실'] },
};

const RANKS = [
  ['ace', '에이스', 'Ace', 'A', ['씨앗', '기회', '시작']],
  ['2', '2', 'Two', 'II', ['균형', '선택', '짝']],
  ['3', '3', 'Three', 'III', ['확장', '협력', '첫 결실']],
  ['4', '4', 'Four', 'IV', ['안정', '멈춤', '지킴']],
  ['5', '5', 'Five', 'V', ['갈등', '결핍', '시험']],
  ['6', '6', 'Six', 'VI', ['회복', '이동', '나눔']],
  ['7', '7', 'Seven', 'VII', ['점검', '인내', '전략']],
  ['8', '8', 'Eight', 'VIII', ['속도', '몰입', '움직임']],
  ['9', '9', 'Nine', 'IX', ['거의 다 옴', '축적', '홀로 버팀']],
  ['10', '10', 'Ten', 'X', ['완결', '과부하', '한 매듭']],
  ['page', '시종', 'Page', 'P', ['배움', '호기심', '소식']],
  ['knight', '기사', 'Knight', 'N', ['행동', '돌진', '추구']],
  ['queen', '여왕', 'Queen', 'Q', ['성숙', '보살핌', '내면의 힘']],
  ['king', '왕', 'King', 'K', ['완숙', '통솔', '책임']],
];

function build() {
  const cards = [];
  for (const [id, ko, en, roman, glyph, up, rev] of MAJORS) {
    cards.push({ id: 'major-' + id, ko, en, roman, glyph, arcana: 'major', suit: null, up, rev });
  }
  for (const [sk, s] of Object.entries(SUITS)) {
    for (const [rk, rko, ren, roman, rkw] of RANKS) {
      cards.push({
        id: `${sk}-${rk}`,
        ko: `${s.ko} ${rko}`,
        en: `${ren} of ${s.en}`,
        roman,
        glyph: sk,
        arcana: 'minor',
        suit: sk,
        suitEl: s.el,
        up: [...rkw, s.theme[0]],
        rev: ['막힘', '지나침', s.theme[0] + ' 저하'],
      });
    }
  }
  return cards;
}

const DECK = build();
const BY_ID = Object.fromEntries(DECK.map((c) => [c.id, c]));

/** 화면 렌더용 공개 정보 (해석 키워드는 최소만) */
function publicDeck() {
  return DECK.map((c) => ({ id: c.id, ko: c.ko, en: c.en, roman: c.roman, glyph: c.glyph, arcana: c.arcana, suit: c.suit }));
}

module.exports = { DECK, BY_ID, SUITS, publicDeck };
