// Profanity screen (Thai + English) for mood text. Server copy is the
// authority; client/src/lib/profanity.ts mirrors it for instant feedback.
// Matching strategy:
//  - NFKC + lowercase, strip zero-width chars
//  - collapse repeated characters (เหี้ยยยย → เหี้ย, fuuuck → fuck) and
//    compare against equally-collapsed words
//  - Thai: substring match (Thai has no word spaces); ambiguous short words
//    guarded with lookaheads to avoid false positives (หี vs หีบ)
//  - English: de-leet (@→a, 0→o, …) then non-letter-boundary match so
//    "class"/"assist" never trip the list

const TH_WORDS = [
  'เหี้ย', 'เหีย', 'เชี่ย', 'เชี้ย', 'สัส', 'ควย', 'เย็ด', 'เงี่ยน',
  'ดอกทอง', 'อีดอก', 'กะหรี่', 'ส้นตีน', 'ระยำ', 'จัญไร', 'แตด', 'หน้าหี',
];
// หี alone needs a guard: match unless it's the start of หีบ (box).
const TH_GUARDED = /หี(?!บ)/;

const EN_WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole',
  'motherfucker', 'bastard', 'slut', 'whore', 'faggot', 'nigger', 'nigga',
];

function collapse(s: string): string {
  return s.replace(/(.)\1+/gu, '$1');
}

function normalizeBase(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[​-‏﻿]/g, '');
}

function deleet(s: string): string {
  return s
    .replace(/[@4]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');
}

export function containsProfanity(text: string): boolean {
  const base = normalizeBase(text);
  const collapsed = collapse(base);

  for (const w of TH_WORDS) {
    if (base.includes(w) || collapsed.includes(collapse(w))) return true;
  }
  if (TH_GUARDED.test(base) || TH_GUARDED.test(collapsed)) return true;

  for (const source of [base, collapsed, deleet(base), deleet(collapsed)]) {
    for (const w of EN_WORDS) {
      const target = source === collapsed || source === deleet(collapsed) ? collapse(w) : w;
      const re = new RegExp(`(?:^|[^a-z])${target}(?:[^a-z]|$)`);
      if (re.test(source)) return true;
    }
  }
  return false;
}
