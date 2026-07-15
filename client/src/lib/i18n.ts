import { create } from 'zustand';

export type Lang = 'th' | 'en';

const STRINGS = {
  tagline: {
    th: 'พื้นที่แชร์ความรู้สึกแบบไม่ระบุตัวตนของชาว KMITL',
    en: 'An anonymous mood-sharing space for KMITL students',
  },
  login: { th: 'เข้าสู่ระบบด้วยบัญชี KMITL', en: 'Sign in with KMITL account' },
  loginNote: { th: 'โพสต์ของคุณไม่ระบุตัวตนเสมอ', en: 'Your posts are always anonymous' },
  feed: { th: 'ฟีด', en: 'Feed' },
  myMoods: { th: 'โพสต์ของฉัน', en: 'My moods' },
  admin: { th: 'ดูแลระบบ', en: 'Admin' },
  logout: { th: 'ออกจากระบบ', en: 'Log out' },
  share: { th: 'แชร์ความรู้สึก', en: 'Share a mood' },
  moods: { th: 'ความรู้สึก', en: 'moods' },
  clear: { th: 'ล้าง', en: 'Clear' },
  allFaculties: { th: 'ทุกคณะ', en: 'All faculties' },
  majorFilterPh: { th: 'กรองตามสาขา…', en: 'Filter by major…' },
  fromDate: { th: 'ตั้งแต่', en: 'From' },
  toDate: { th: 'ถึง', en: 'To' },
  feedEmpty: { th: 'ยังไม่มีโพสต์ตรงกับตัวกรอง ลองเปลี่ยนตัวกรองดูนะ', en: 'No posts match these filters yet.' },
  loadMore: { th: 'โหลดเพิ่ม', en: 'Load more' },
  loading: { th: 'กำลังโหลด…', en: 'Loading…' },
  errorGeneric: { th: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', en: 'Something went wrong. Please try again.' },
  retry: { th: 'ลองใหม่', en: 'Retry' },
  composerTitle: { th: 'ตอนนี้รู้สึกยังไง?', en: 'How are you feeling?' },
  editTitle: { th: 'แก้ไขโพสต์', en: 'Edit post' },
  composerPh: { th: 'เล่าให้ฟังหน่อย… (ไม่ระบุตัวตน)', en: 'Tell us about it… (anonymous)' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  post: { th: 'โพสต์', en: 'Post' },
  save: { th: 'บันทึก', en: 'Save' },
  delete: { th: 'ลบ', en: 'Delete' },
  deleteConfirmTitle: { th: 'ลบโพสต์นี้?', en: 'Delete this post?' },
  deleteConfirmBody: { th: 'ลบแล้วกู้คืนไม่ได้', en: 'This cannot be undone.' },
  onboardTitle: { th: 'อีกนิดเดียว!', en: 'Almost there!' },
  onboardSub: {
    th: 'บอกคณะ สาขา และชั้นปี เพื่อให้เพื่อน ๆ เห็นบริบทของความรู้สึก (ไม่ระบุชื่อ)',
    en: 'Tell us your faculty, major, and year — shown with posts, never your name.',
  },
  faculty: { th: 'คณะ', en: 'Faculty' },
  selectFaculty: { th: 'เลือกคณะ', en: 'Select faculty' },
  major: { th: 'สาขา', en: 'Major' },
  majorPh: { th: 'พิมพ์ชื่อสาขา…', en: 'Type your major…' },
  year: { th: 'ชั้นปี', en: 'Year' },
  continue: { th: 'เริ่มใช้งาน', en: 'Continue' },
  mineTitle: { th: 'โพสต์ของฉัน', en: 'My moods' },
  mineSub: { th: 'เห็นเฉพาะคุณ แก้ไขหรือลบได้ทุกโพสต์', en: 'Only you can see this list. Edit or delete anything.' },
  mineEmpty: { th: 'คุณยังไม่เคยโพสต์เลย', en: "You haven't posted yet." },
  adminTitle: { th: 'คิวดูแลเนื้อหา', en: 'Moderation queue' },
  adminSub: { th: 'ลบโพสต์ที่ไม่เหมาะสมได้จากรายการทั้งหมด', en: 'Remove inappropriate posts from the full list.' },
  minutesAgo: { th: 'นาทีที่แล้ว', en: 'min ago' },
  hoursAgo: { th: 'ชม.ที่แล้ว', en: 'hr ago' },
  daysAgo: { th: 'วันที่แล้ว', en: 'd ago' },
  justNow: { th: 'เมื่อกี้', en: 'just now' },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang];
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: (localStorage.getItem('mm-lang') as Lang) || 'th',
  setLang: (lang) => {
    localStorage.setItem('mm-lang', lang);
    set({ lang });
  },
}));

export function relTime(iso: string, lang: Lang): string {
  const ms = Date.now() - Date.parse(iso);
  const min = Math.floor(ms / 60000);
  if (min < 1) return t('justNow', lang);
  if (min < 60) return `${min} ${t('minutesAgo', lang)}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t('hoursAgo', lang)}`;
  const d = Math.floor(hr / 24);
  return `${d} ${t('daysAgo', lang)}`;
}
