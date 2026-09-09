'use strict';

/**
 * Claude 호출 래퍼. 두 가지 방식을 지원하며 AI_PROVIDER 로 고른다.
 *
 *  - AI_PROVIDER=api  (기본): Anthropic API + ANTHROPIC_API_KEY. 쓴 만큼 후불 과금.
 *                             여러 사용자에게 서비스하는 유료 버전은 반드시 이 방식.
 *  - AI_PROVIDER=cli  : 로컬 `claude -p` + 구독요금제(setup-token). 개인 개발/테스트 전용.
 *                       ⚠ 구독 인증을 제3자에게 제공하는 건 약관 위반이므로 배포 금지.
 *
 * 공개 API:
 *  - askStream(prompt, { onDelta, signal, system }) → Promise<string>  (스트리밍, 사주 풀이용)
 *  - ask(prompt, { system })                        → Promise<string>  (단발, 헬스체크용)
 *  - healthCheck()                                  → { ok, ms, sample }
 */

const { spawn } = require('child_process');
const log = require('./logger');

let ENV_FILE_KEYS = new Set();
try {
  ENV_FILE_KEYS = new Set(Object.keys(require('dotenv').config().parsed || {}));
} catch {
  /* dotenv 없거나 .env 없음 */
}

const PROVIDER = (process.env.AI_PROVIDER || 'api').toLowerCase();
const MODEL = process.env.CLAUDE_MODEL || (PROVIDER === 'api' ? 'claude-sonnet-5' : '');
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 180000);
const MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS || 8000);

/* ────────────────────────────────────────────────────────────────────────────
 * 1) Anthropic API 방식 (@anthropic-ai/sdk)
 * ──────────────────────────────────────────────────────────────────────────── */

let _sdk = null;
let _client = null;

function apiClient() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY 가 없습니다. console.anthropic.com 에서 키를 발급해 .env 에 넣으세요. ' +
        '(개인 로컬 테스트만 할 거면 .env 에 AI_PROVIDER=cli 로 바꿔도 됩니다.)'
    );
  }
  _sdk = _sdk || require('@anthropic-ai/sdk');
  _client = new _sdk({ maxRetries: 2, timeout: TIMEOUT_MS });
  return _client;
}

function apiError(err) {
  const A = _sdk || {};
  if (A.AuthenticationError && err instanceof A.AuthenticationError) {
    return new Error('Anthropic API 키가 유효하지 않습니다. .env 의 ANTHROPIC_API_KEY 를 확인하세요.');
  }
  if (A.RateLimitError && err instanceof A.RateLimitError) {
    return new Error('API 사용량 한도에 걸렸습니다. 잠시 후 다시 시도하세요.');
  }
  if (A.BadRequestError && err instanceof A.BadRequestError) {
    return new Error('API 요청 오류: ' + err.message);
  }
  return err;
}

async function askStreamApi(prompt, { onDelta, signal, system }) {
  const stream = apiClient().messages.stream(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    },
    signal ? { signal } : undefined
  );

  let full = '';
  stream.on('text', (t) => {
    full += t;
    try {
      onDelta(t);
    } catch (e) {
      log.warn('onDelta 처리 오류:', e.message);
    }
  });

  try {
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new Error('AI가 이 요청에 대한 답변을 거절했습니다.');
    }
    if (!full) {
      full = (final.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
    }
    return full;
  } catch (err) {
    if (signal && signal.aborted) throw new Error('요청이 취소되었습니다');
    throw apiError(err);
  }
}

async function askApi(prompt, { system, maxTokens = 64, model } = {}) {
  try {
    const res = await apiClient().messages.create({
      model: model || MODEL,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    return (res.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  } catch (err) {
    throw apiError(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 2) 로컬 `claude -p` 방식 (개인 개발 전용)
 * ──────────────────────────────────────────────────────────────────────────── */

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

function isWin() {
  return process.platform === 'win32';
}

function childEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (ENV_FILE_KEYS.has(k)) continue;
    if (k === 'CLAUDE_CODE_OAUTH_TOKEN') continue;
    if (k === 'CLAUDECODE' || k === 'CLAUDE_PID' || k.startsWith('CLAUDE_CODE_')) delete env[k];
  }
  delete env.CLAUDE_AGENT_SDK_VERSION;
  if (!ENV_FILE_KEYS.has('ANTHROPIC_BASE_URL')) delete env.ANTHROPIC_BASE_URL;
  if (!ENV_FILE_KEYS.has('ANTHROPIC_AUTH_TOKEN')) delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function spawnClaude(args) {
  const win = isWin();
  const cmd = win ? `"${CLAUDE_BIN}" ${args.join(' ')}` : CLAUDE_BIN;
  return spawn(win ? cmd : CLAUDE_BIN, win ? [] : args, {
    shell: win,
    windowsHide: true,
    env: childEnv(),
  });
}

function loginError(msg) {
  return new Error(
    'Claude 구독 인증이 필요합니다 (AI_PROVIDER=cli). 일반 터미널에서 `claude setup-token` 실행 →\n' +
      '나온 토큰을 .env 의 CLAUDE_CODE_OAUTH_TOKEN 에 넣고 서버를 재시작하세요.' +
      (msg ? `\n(원문: ${msg})` : '')
  );
}

function spawnErr(err) {
  if (err && err.code === 'ENOENT') {
    return new Error(
      `claude 실행 파일을 찾을 수 없습니다 (CLAUDE_BIN="${CLAUDE_BIN}"). ` +
        `"npm i -g @anthropic-ai/claude-code" 후 PATH 확인, 또는 .env 의 CLAUDE_BIN 설정.`
    );
  }
  return err;
}

function askCli(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json'];
    if (MODEL) args.push('--model', MODEL);
    const child = spawnClaude(args);
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill('SIGKILL');
      reject(new Error(`claude -p 타임아웃 (${TIMEOUT_MS}ms)`));
    }, TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(spawnErr(err));
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      let parsed = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {}
      if (parsed && parsed.is_error) {
        const msg = String(parsed.result || parsed.error || 'unknown');
        return reject(/not logged in|please run \/login|invalid api key|oauth/i.test(msg) ? loginError(msg) : new Error('claude 오류: ' + msg));
      }
      if (!parsed) {
        if (code !== 0) {
          const tail = (stderr || stdout || '(출력 없음)').slice(0, 800);
          return reject(/not logged in|please run \/login/i.test(tail) ? loginError(tail) : new Error(`claude -p 종료코드 ${code}: ${tail}`));
        }
        return resolve(stdout.trim());
      }
      const text = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed);
      resolve(text.trim());
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function askStreamCli(prompt, opts) {
  const { onDelta } = opts;
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
    if (MODEL) args.push('--model', MODEL);
    const child = spawnClaude(args);
    let full = '';
    let buf = '';
    let stderr = '';
    let done = false;

    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
      fn(arg);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`claude -p 타임아웃 (${TIMEOUT_MS}ms)`));
    }, TIMEOUT_MS);
    const onAbort = () => {
      child.kill('SIGKILL');
      finish(reject, new Error('요청이 취소되었습니다'));
    };
    if (opts.signal) {
      if (opts.signal.aborted) return onAbort();
      opts.signal.addEventListener('abort', onAbort);
    }

    const emit = (text) => {
      if (!text) return;
      full += text;
      try {
        onDelta(text);
      } catch (e) {
        log.warn('onDelta 처리 오류:', e.message);
      }
    };
    const handleObj = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.type === 'stream_event' && obj.event) {
        const ev = obj.event;
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') emit(ev.delta.text || '');
        return;
      }
      if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
        const text = obj.message.content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
        if (text && text.length > full.length && text.startsWith(full)) emit(text.slice(full.length));
        else if (text && !full) emit(text);
        return;
      }
      if (obj.type === 'result') {
        if (obj.is_error) {
          const msg = String(obj.result || obj.error || 'unknown');
          return finish(reject, /not logged in|please run \/login|invalid api key|oauth/i.test(msg) ? loginError(msg) : new Error('claude 오류: ' + msg));
        }
        if (!full && typeof obj.result === 'string') emit(obj.result);
        return finish(resolve, full);
      }
    };

    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          handleObj(JSON.parse(line));
        } catch {}
      }
    });
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => finish(reject, spawnErr(err)));
    child.on('close', (code) => {
      if (done) return;
      if (code === 0) return finish(resolve, full);
      const tail = (stderr || '(stderr 없음)').slice(0, 800);
      finish(reject, /not logged in|please run \/login/i.test(tail) ? loginError(tail) : new Error(`claude -p 종료코드 ${code}: ${tail}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * 공개 API — PROVIDER 로 분기
 * ──────────────────────────────────────────────────────────────────────────── */

function askStream(prompt, opts) {
  if (!opts || typeof opts.onDelta !== 'function') throw new Error('askStream: onDelta 콜백이 필요합니다');
  return PROVIDER === 'cli' ? askStreamCli(prompt, opts) : askStreamApi(prompt, opts);
}

function ask(prompt, opts = {}) {
  return PROVIDER === 'cli' ? askCli(prompt) : askApi(prompt, opts);
}

/** JSON 응답 강제 + 파싱 (실패 시 1회 재시도). teaser 위젯용. */
async function askJson(prompt, { system, maxTokens = 1200, model } = {}) {
  const wrap = (p) => p + '\n\n반드시 유효한 JSON 하나만 출력. 코드펜스·설명 없이 JSON 본문만.';
  const parse = (t) => {
    const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const cand = m ? m[1] : t;
    const s = cand.search(/[[{]/);
    const e = Math.max(cand.lastIndexOf('}'), cand.lastIndexOf(']'));
    return JSON.parse(s >= 0 && e > s ? cand.slice(s, e + 1) : cand.trim());
  };
  const t1 = await (PROVIDER === 'cli' ? askCli(wrap(prompt)) : askApi(wrap(prompt), { system, maxTokens, model }));
  try {
    return parse(t1);
  } catch {
    const t2 = await (PROVIDER === 'cli' ? askCli('다음을 유효한 JSON 하나로만 다시 출력:\n' + t1) : askApi('다음을 유효한 JSON 하나로만 다시 출력:\n' + t1, { maxTokens, model }));
    return parse(t2);
  }
}

async function healthCheck() {
  const started = Date.now();
  const text = await ask('Reply with exactly: pong', { system: 'You are a test echo.' });
  // 응답 텍스트가 있으면 인증·모델 정상 (표기가 "퐁" 등으로 바뀌어도 통과)
  const ok = text.trim().length > 0 && text.trim().length < 60;
  return { ok, ms: Date.now() - started, sample: text.slice(0, 80), provider: PROVIDER, model: MODEL || '(기본값)' };
}

module.exports = { ask, askJson, askStream, healthCheck, PROVIDER, MODEL };
