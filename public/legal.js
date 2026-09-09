'use strict';
/* 약관/개인정보/환불 페이지 하단 사업자정보 채우기 (/api/config → branding.business) */
(async function () {
  let b = {};
  try {
    const cfg = await (await fetch('/api/config')).json();
    b = (cfg.branding && cfg.branding.business) || {};
  } catch {}

  const v = (k) => (b[k] && String(b[k]).trim()) || '미정';

  document.querySelectorAll('[data-biz]').forEach((el) => {
    el.textContent = v(el.getAttribute('data-biz'));
  });

  const rows = [
    ['상호', v('name')],
    ['대표자', v('owner')],
    ['사업자등록번호', v('bizNo')],
    ['통신판매업 신고번호', v('mailOrderNo')],
    ['사업장 주소', v('address')],
    ['연락처', v('tel')],
    ['이메일', v('email')],
  ];
  document.querySelectorAll('[data-bizinfo]').forEach((el) => {
    el.innerHTML =
      '<div class="bizinfo__t">사업자 정보</div>' +
      rows.map(([k, val]) => `<div><span>${k}</span>${val}</div>`).join('');
  });
})();
