/* The typing timeline: one live clock; keystrokes are the heartbeat of every signal in the world. */
const hash = (a, b, c) => { let h = (a * 374761393 + (b || 0) * 668265263 + (c || 0) * 2147483647 + 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export { hash, rng };
export const CYCLE = 17, PROMPT = 'Why is the sky blue?', REPLY = 'Sunlight scatters off air molecules, and blue light scatters most.';
export const KT = []; let t0 = 1.4; { const r = rng(11); for (let i = 0; i < PROMPT.length; i++) { KT.push(t0); t0 += 0.15 + r() * 0.2 + (PROMPT[i] === ' ' ? 0.1 : 0); } }
export const SEND = t0 + 0.55, SEND_LEN = 4.2, REPLY_T = SEND + 3.3;
export function state(t) {
  const c = ((t % CYCLE) + CYCLE) % CYCLE; let n = 0;
  for (let i = 0; i < KT.length; i++) if (c >= KT[i]) n = i + 1;
  const sent = c >= SEND, ages = []; let E = 0, last = -1;
  for (let i = 0; i < KT.length; i++) { const age = c - KT[i]; if (age >= 0 && age < 3) { ages.push([i, age]); E += Math.exp(-age / 0.22); } }
  if (n > 0 && c < SEND) last = c - KT[n - 1];
  return { c, typed: sent ? PROMPT.length : n, sent, send: sent ? Math.min(1.2, (c - SEND) / SEND_LEN) : -1, reply: c > REPLY_T ? Math.min(REPLY.length, Math.floor((c - REPLY_T) * 11)) : 0, E: Math.min(1.4, E), ages, sinceKey: last, caret: Math.floor(c * 2) % 2 === 0 };
}
