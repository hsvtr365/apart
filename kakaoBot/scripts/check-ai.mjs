import { readFileSync } from 'node:fs';
import { jsonFetch } from '../src/http.mjs';
const base = new URL(process.env.GEMMA_BASE_URL || 'https://gitlab.swempire.co.kr/ollama/');
const model = process.env.GEMMA_MODEL || 'gemma4:26b';
try {
  if (base.protocol !== 'https:' || base.username || base.password || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('tls-required');
  const info = await jsonFetch(new URL('api/show', base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) }, 20_000);
  if (!info.capabilities?.includes('vision')) throw new Error('vision-not-advertised');
  console.log(JSON.stringify({ probe: 'model', model, vision: true }));
  for (const [name, code, date, count] of [['a', 'MAPLE-7319', '2026-11-12', 3], ['b', 'CEDAR-4286', '2026-12-07', 2]]) {
    const start = Date.now();
    const result = await jsonFetch(new URL('api/chat', base), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, think: false, format: 'json', options: { temperature: 0, num_predict: 700 }, messages: [{ role: 'user',
        content: '이미지에 적힌 검증 코드, 행사일, 시간, 장소를 읽고 빨간 원을 세세요. JSON 키: code,date,time,place,redCircleCount. 이미지 정보만 사용하세요.',
        images: [readFileSync(new URL(`../tests/fixtures/gemma-vision-${name}.png`, import.meta.url)).toString('base64')] }] }),
    }, 180_000);
    const value = JSON.parse(result.message.content);
    const passed = value.code === code && value.date === date && Number(value.redCircleCount) === count;
    console.log(JSON.stringify({ probe: 'vision', fixture: name, passed, elapsedMs: Date.now() - start }));
    if (!passed) process.exitCode = 1;
  }
} catch { console.error(JSON.stringify({ probe: 'gemma', passed: false })); process.exitCode = 1; }
