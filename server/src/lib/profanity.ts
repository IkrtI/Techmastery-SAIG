// Moderation screen (Thai + English). Server copy is the authority;
// client/src/lib/profanity.ts mirrors it for instant feedback.
// Matching strategy:
//  - NFKC + lowercase, strip zero-width chars and apostrophes
//  - collapse repeated characters (เหี้ยยยย → เหี้ย, fuuuck → fuck) and
//    compare against equally-collapsed words
//  - Thai: substring match (Thai has no word spaces) across four variants —
//    raw, collapsed, separator-stripped (catches "เ หี้ ย" / "ค.ว.ย"), and
//    stripped+collapsed; ambiguous short words carry lookahead guards
//  - English: de-leet (@→a, 0→o, …) then non-letter-boundary match so
//    "class"/"assist" never trip the list
// Three tiers:
//  - containsProfanity: vulgar words — blocked everywhere (posts + comments)
//  - containsHarm: hostile / "go die" phrases — extra comment-only tier
//  - containsSelfHarm: self-harm expressions — blocked everywhere; the client
//    responds with a support dialog (KMITL SOS + hotline 1323), not a scold

const TH_WORDS = [
  'เหี้ย', 'เหีย', 'เฮี้ย', 'เชี่ย', 'เชี้ย', 'สัส', 'ควย', 'เย็ด', 'เยด',
  'เงี่ยน', 'ดอกทอง', 'อีดอก', 'กะหรี่', 'ส้นตีน', 'ระยำ', 'จัญไร', 'แตด',
  'หน้าหี', 'หมอย', 'สันดาน', 'อีตัว', 'อีเวร', 'ไอ้เวร', 'ไอ้สัตว์',
  'อีสัตว์', 'ไอ้ควาย', 'อีควาย', 'ไอ้บ้า', 'อีบ้า', 'ไอ้โง่', 'อีโง่',
  'ไอ้ชั่ว', 'อีชั่ว', 'ไอ้หมา', 'อีหมา', 'ชาติหมา', 'หน้าตัวเมีย', 'ตอแหล',
  'สถุน', 'อัปรี', 'อับปรี', 'ชิบหาย', 'ฉิบหาย', 'พ่อง', 'พ่อมึง', 'แม่มึง',
  'เสือก',
];
// Short Thai words that collide with innocent longer words need lookahead guards.
const TH_GUARDED = [
  /หี(?![บ่])/, // หี but not หีบ (box) or เหี่ย- sequences (own guard below)
  /สัด(?!ส่วน)/, // สัด but not สัดส่วน (proportion)
  /ห่า(?![งน])/, // ห่า but not ห่าง (far) / ห่าน (goose)
  /เหี่ย(?!ว)/, // เหี่ย but not เหี่ยว (wilted)
];

const EN_WORDS = [
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckin', 'fck', 'fuk', 'fuckface',
  'shit', 'shitty', 'bullshit', 'shithead', 'bitch', 'cunt', 'dick',
  'dickhead', 'dickwad', 'cock', 'cocksucker', 'pussy', 'ass', 'arse',
  'asshole', 'asshat', 'motherfucker', 'bastard', 'slut', 'whore', 'thot',
  'faggot', 'fag', 'nigger', 'nigga', 'chink', 'spic', 'kike', 'retard',
  'retarded', 'twat', 'wanker', 'wank', 'prick', 'dumbass', 'jackass',
  'douche', 'skank', 'bollocks', 'jizz', 'porn', 'tits', 'stfu',
];

// Hostile phrases directed at the reader — comment-only tier.
const TH_HARM = [
  'ไปตาย', 'ตายซะ', 'ตายๆ', 'ไปฆ่าตัวตาย', 'ฆ่าตัวตายไปเลย', 'สมน้ำหน้า',
  'อ่อนแอก็แพ้ไป', 'ไปเกิดใหม่', 'น่าสมเพช', 'ไม่น่าเกิดมา',
];
const EN_HARM = [
  'kys', 'kill yourself', 'kill urself', 'go die', 'die already',
  'end yourself', 'neck yourself', 'unalive yourself', 'off yourself',
  'drink bleach', 'get cancer', 'rot in hell',
];

// Self-harm tier — matched with the same machinery. Blocking is paired with
// care resources (SupportDialog / SOS + 1323 in the 400 message), never a
// bare rejection.
const TH_SELF_HARM = [
  'อยากตาย', 'ฆ่าตัวตาย', 'ทำร้ายตัวเอง', 'ทำร้ายตนเอง', 'กรีดข้อมือ',
  'กรีดแขน', 'กรีดตัวเอง', 'เชือดข้อมือ', 'ปาดข้อมือ', 'ผูกคอตาย',
  'อยากผูกคอ', 'กินยาตาย', 'กินยาเกินขนาด', 'โดดตึก', 'กระโดดตึก',
  'จบชีวิต', 'จะตายให้ดู', 'ลาโลก', 'ขอตาย', 'ไม่อยากอยู่แล้ว',
  'ไม่อยากมีชีวิต', 'ไม่อยากหายใจ', 'อยากหายไปจากโลก',
];
const EN_SELF_HARM = [
  'suicide', 'kill myself', 'killing myself', 'kms', 'self harm', 'self-harm',
  'selfharm', 'harm myself', 'harming myself', 'hurt myself',
  'hurting myself', 'cut myself', 'cutting myself', 'slit my wrist',
  'cut my wrist', 'hang myself', 'drown myself', 'starve myself', 'overdose',
  'end my life', 'end it all', 'take my own life', 'want to die',
  'wanna die', 'wish i was dead', 'wish i were dead', 'no reason to live',
  'dont want to live', 'dont wanna live', 'better off dead', 'unalive',
];

// Lists are written in composed Thai; inputs are NFKC-normalized (which
// decomposes ำ → ํ + า), so normalize the lists once at module init or words
// like ระยำ / สมน้ำหน้า would never match.
const N = (words: string[]): string[] => words.map((w) => normalizeBase(w));
const TH_WORDS_N = N(TH_WORDS);
const TH_HARM_N = N(TH_HARM);
const TH_SELF_HARM_N = N(TH_SELF_HARM);

function collapse(s: string): string {
  return s.replace(/(.)\1+/gu, '$1');
}

function normalizeBase(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .replace(/[\u2019']/g, '');
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

/** Raw, collapsed, separator-stripped, stripped+collapsed — Thai only. */
function thaiVariants(base: string, collapsed: string): string[] {
  const tight = base.replace(/[\s.\-_*·|/\\]+/gu, '');
  return [base, collapsed, tight, collapse(tight)];
}

function hitThai(variants: string[], words: string[]): boolean {
  return words.some((w) => {
    const cw = collapse(w);
    return variants.some((v) => v.includes(w) || v.includes(cw));
  });
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
  const variants = thaiVariants(base, collapsed);
  if (hitThai(variants, TH_WORDS_N)) return true;
  if (TH_GUARDED.some((re) => variants.some((v) => re.test(v)))) return true;
  return hitEnglish(base, collapsed, EN_WORDS);
}

export function containsHarm(text: string): boolean {
  const base = normalizeBase(text);
  const collapsed = collapse(base);
  return hitThai(thaiVariants(base, collapsed), TH_HARM_N) || hitEnglish(base, collapsed, EN_HARM);
}

export function containsSelfHarm(text: string): boolean {
  const base = normalizeBase(text);
  const collapsed = collapse(base);
  return hitThai(thaiVariants(base, collapsed), TH_SELF_HARM_N) || hitEnglish(base, collapsed, EN_SELF_HARM);
}
