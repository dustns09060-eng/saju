'use strict';

/** 아주 얇은 로거. 콘솔 + 메모리 링버퍼(대시보드 노출용). */
const ring = [];
const MAX = 500;

function push(level, args) {
  const line = {
    t: new Date().toISOString(),
    level,
    msg: args
      .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
      .join(' '),
  };
  ring.push(line);
  if (ring.length > MAX) ring.shift();
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[${line.t}] ${level.toUpperCase()} ${line.msg}`);
}

function safeStringify(o) {
  try {
    return JSON.stringify(o);
  } catch {
    return String(o);
  }
}

module.exports = {
  info: (...a) => push('info', a),
  warn: (...a) => push('warn', a),
  error: (...a) => push('error', a),
  recent: (n = 100) => ring.slice(-n),
};
