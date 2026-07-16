// Profanity + hostility screen (Thai + English). Server copy is the
// authority; client/src/lib/profanity.ts mirrors it for instant feedback.
// Matching strategy:
//  - NFKC + lowercase, strip zero-width chars
//  - collapse repeated characters (เหี้ยยยย → เหี้ย, fuuuck → fuck) and
//    compare against equally-collapsed words
//  - Thai: substring match (Thai has no word spaces); ambiguous short words
//    guarded with lookaheads to avoid false positives (หี vs หีบ)
//  - English: de-leet (@→a, 0→o, …) then non-letter-boundary match so
//    "class"/"assist" never trip the list
// Three tiers:
//  - containsProfanity: vulgar words — blocked everywhere (posts + comments)
//  - containsHarm: hostile / "go die" phrases — extra comment-only tier
//  - containsSelfHarm: self-harm expressions — blocked everywhere; the client
//    responds with a support dialog (KMITL SOS + hotline 1323), not a scold

const TH_WORDS = [
  'เหี้ย', 'เหีย', 'เชี่ย', 'เชี้ย', 'สัส', 'ควย', 'เย็ด', 'เยด', 'เงี่ยน',
  'ดอกทอง', 'อีดอก', 'กะหรี่', 'ส้นตีน', 'ระยำ', 'จัญไร', 'แตด', 'หน้าหี',
  'หมอย', 'สันดาน', 'อีตัว', 'อีเวร', 'ไอ้เวร', 'ไอ้สัตว์', 'อีสัตว์',
  'ไอ้ควาย', 'อีควาย', 'ไอ้บ้า', 'อีบ้า', 'ไอ้โง่', 'อีโง่', 'ชาติหมา',
  'พ่อง', 'พ่อมึง', 'แม่มึง', 'เสือก',
];
// Short Thai words that collide with innocent longer words need lookahead guards.
const TH_GUARDED = [
  /หี(?!บ)/, // หี but not หีบ (box)
  /สัด(?!ส่วน)/, // สัด but not สัดส่วน (proportion)
  /ห่า(?![งน])/, // ห่า but not ห่าง (far) / ห่าน (goose)
];

const EN_WORDS = [
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckin', 'fck', 'fuk',
  'shit', 'shitty', 'bullshit', 'bitch', 'cunt', 'dick', 'dickhead',
  'cock', 'pussy', 'asshole', 'asshat', 'motherfucker', 'bastard',
  'slut', 'whore', 'faggot', 'nigger', 'nigga', 'retard', 'retarded',
  'twat', 'wanker', 'prick', 'dumbass', 'jackass', 'douche', 'skank',
];

// Hostile phrases directed at the reader — comment-only tier.
const TH_HARM = ['ไปตาย', 'ตายซะ', 'ตายๆ', 'ไปฆ่าตัวตาย', 'ฆ่าตัวตายไปเลย'];
const EN_HARM = [
  'kys', 'kill yourself', 'kill urself', 'go die', 'die already',
  'end yourself', 'neck yourself', 'unalive yourself',
];

// Self-harm tier — matched with the same Thai-substring / English-boundary
// machinery. Blocking is paired with care resources, never a bare rejection.
const TH_SELF_HARM = [
  'อยากตาย', 'ฆ่าตัวตาย', 'ทำร้ายตัวเอง', 'ทำร้ายตนเอง', 'กรีดข้อมือ',
  'กรีดแขน', 'ผูกคอตาย', 'กินยาตาย', 'จบชีวิต', 'ไม่อยากอยู่แล้ว',
  'ไม่อยากมีชีวิต', 'อยากหายไปจากโลก',
];
const EN_SELF_HARM = [
  'suicide', 'kill myself', 'killing myself', 'kms', 'self harm', 'self-harm',
  'selfharm', 'hurt myself', 'cut myself', 'end my life', 'want to die',
  'wanna die', 'unalive',
];

function collapse(s: string): string {
  return s.replace(/(.)\1+/gu, '$1');
}

function normalizeBase(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[\u200b-\u200f\ufeff]/g, '');
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

function hitThai(base: string, collapsed: string, words: string[]): boolean {
  return words.some((w) => base.includes(w) || collapsed.includes(collapse(w)));
}

function hitEnglish(base: string, collapsed: string, words: string[]): boolean {
  for (const source of [base, collapsed, deleet(base), deleet(collapsed)]) {
    const isCollapsed = source === collapsed || source === deleet(collapsed);
    for (const w of words) {
      const target = isCollapsed ? collapse(w) : w;
      const re = new RegExp(`(?:^|[^a-z])${target}(?:[^a-z]|$)`);
      if (re.test(source)) return true;
    }
  }
  return false;
}

export function containsProfanity(text: string): boolean {
  const base = normalizeBase(text);
  const collapsed = collapse(base);
  if (hitThai(base, collapsed, TH_WORDS)) return true;
  if (TH_GUARDED.some((re) => re.test(base) || re.test(collapsed))) return true;
  return hitEnglish(base, collapsed, EN_WORDS);
}

export function containsHarm(text: string): boolean {
  const base = normalizeBase(text);
  const collapsed = collapse(base);
  return hitThai(base, collapsed, TH_HARM) || hitEnglish(base, collapsed, EN_HARM);
}

export function containsSelfHarm(text: string): boolean {
  const base = normalizeBase(text);
  const collapsed = collapse(base);
  return hitThai(base, collapsed, TH_SELF_HARM) || hitEnglish(base, collapsed, EN_SELF_HARM);
}
