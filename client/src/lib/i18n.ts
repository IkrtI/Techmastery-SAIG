import { create } from 'zustand';

export type Lang = 'th' | 'en';

const STRINGS = {
  landingH1: { th: 'รู้สึกยังไงกันบ้าง\nตอนนี้เลย', en: 'How is everyone\nfeeling right now?' },
  landingSub: {
    th: 'แชร์อารมณ์แบบไม่ระบุตัวตน แล้วดูว่าทั้งรั้ว KMITL กำลังรู้สึกแบบไหนอยู่',
    en: 'Share your mood anonymously and see how all of KMITL is feeling.',
  },
  login: { th: 'เข้าสู่ระบบด้วย KMITL', en: 'Sign in with KMITL' },
  loginNote: { th: 'สำหรับนักศึกษา KMITL เท่านั้น · ไม่ระบุตัวตน', en: 'KMITL students only · always anonymous' },
  feed: { th: 'ฟีด', en: 'Feed' },
  myMoods: { th: 'โพสต์ของฉัน', en: 'My posts' },
  admin: { th: 'ผู้ดูแลระบบ', en: 'Admin' },
  logout: { th: 'ออกจากระบบ', en: 'Log out' },
  menu: { th: 'เมนู', en: 'Menu' },
  themeLabel: { th: 'ธีม', en: 'Theme' },
  langLabel: { th: 'ภาษา', en: 'Language' },
  themeDark: { th: 'มืด', en: 'Dark' },
  themeLight: { th: 'สว่าง', en: 'Light' },
  feedTitle: { th: 'ฟีดความรู้สึก', en: 'Mood feed' },
  statsCaption: { th: 'เหตุการณ์ที่ตรงกับตัวกรอง', en: 'posts matching filters' },
  filters: { th: 'ตัวกรอง', en: 'Filters' },
  clearFilters: { th: 'ล้างตัวกรอง', en: 'Clear filters' },
  viewResults: { th: 'ดูผลลัพธ์', en: 'View results' },
  faculty: { th: 'คณะ', en: 'Faculty' },
  allFaculties: { th: 'ทุกคณะ', en: 'All faculties' },
  major: { th: 'สาขา', en: 'Major' },
  majorSearchPh: { th: 'ค้นหาสาขา', en: 'Search major' },
  fromDate: { th: 'จากวันที่', en: 'From' },
  toDate: { th: 'ถึงวันที่', en: 'To' },
  feedErrorTitle: { th: 'โหลดฟีดไม่สำเร็จ', en: 'Could not load the feed' },
  feedErrorSub: { th: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง', en: 'A connection error occurred. Please try again.' },
  retry: { th: 'ลองอีกครั้ง', en: 'Try again' },
  emptyTitle: { th: 'ไม่พบเหตุการณ์ที่ตรงกับตัวกรอง', en: 'Nothing matches these filters' },
  emptySub: { th: 'ลองเปลี่ยนตัวกรอง หรือดูทั้งหมดอีกครั้ง', en: 'Try changing the filters or view everything again.' },
  loading: { th: 'กำลังโหลด…', en: 'Loading…' },
  loadingMore: { th: 'กำลังโหลดเพิ่มเติม…', en: 'Loading more…' },
  allSeen: { th: 'คุณดูครบทุกเหตุการณ์แล้ว', en: "You're all caught up" },
  fab: { th: 'โพสต์ความรู้สึก', en: 'Share a mood' },
  edit: { th: 'แก้ไข', en: 'Edit' },
  delete: { th: 'ลบ', en: 'Delete' },
  deleteConfirmQ: { th: 'ลบโพสต์นี้ใช่ไหม?', en: 'Delete this post?' },
  confirm: { th: 'ยืนยัน', en: 'Confirm' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  composerTitleNew: { th: 'โพสต์ความรู้สึกของคุณ', en: 'Share how you feel' },
  composerTitleEdit: { th: 'แก้ไขความรู้สึก', en: 'Edit your post' },
  moodPrompt: { th: 'ตอนนี้คุณรู้สึกแบบไหน', en: 'How do you feel right now?' },
  composerPh: { th: 'เล่าให้ฟังหน่อยว่าเกิดอะไรขึ้น… (ไม่ระบุตัวตน)', en: 'Tell us what happened… (anonymous)' },
  post: { th: 'โพสต์', en: 'Post' },
  saveEdit: { th: 'บันทึกการแก้ไข', en: 'Save changes' },
  toastPosted: { th: 'โพสต์ความรู้สึกแล้ว', en: 'Posted' },
  toastSaved: { th: 'บันทึกการแก้ไขแล้ว', en: 'Changes saved' },
  toastDeleted: { th: 'ลบโพสต์แล้ว', en: 'Post deleted' },
  toastAdminDeleted: { th: 'ลบโพสต์แล้ว (ผู้ดูแลระบบ)', en: 'Post deleted (admin)' },
  onboardTitle: { th: 'ก่อนเริ่มใช้งาน', en: 'Before you start' },
  onboardSub: {
    th: 'บอกเราหน่อยว่าคุณเรียนอะไรอยู่ — ข้อมูลนี้จะไม่ผูกกับตัวตนของคุณ',
    en: 'Tell us what you study — this is never tied to your identity.',
  },
  selectFaculty: { th: 'เลือกคณะของคุณ', en: 'Select your faculty' },
  majorLabel: { th: 'สาขา / วิชาเอก', en: 'Major / field of study' },
  majorPh: { th: 'พิมพ์ หรือเลือกจากตัวเลือกด้านล่าง', en: 'Type, or pick a suggestion below' },
  yearLabel: { th: 'ปีที่เรียน', en: 'Year of study' },
  yearPrefix: { th: 'ปี ', en: 'Year ' },
  start: { th: 'เริ่มใช้งาน', en: 'Get started' },
  editProfile: { th: 'แก้ไขโปรไฟล์', en: 'Edit profile' },
  save: { th: 'บันทึก', en: 'Save' },
  toastProfileSaved: { th: 'บันทึกโปรไฟล์แล้ว', en: 'Profile saved' },
  yearAutoHint: { th: 'เลือกให้อัตโนมัติจากรหัสนักศึกษา แก้ได้ถ้าไม่ตรง', en: 'Auto-selected from your student ID — change it if wrong' },
  mineCountSuffix: { th: 'เหตุการณ์ที่คุณเคยแชร์', en: 'posts you have shared' },
  mineEmpty: { th: 'คุณยังไม่ได้แชร์ความรู้สึกใดๆ', en: "You haven't shared anything yet" },
  postFirst: { th: 'โพสต์ความรู้สึกแรกของคุณ', en: 'Share your first mood' },
  adminTitle: { th: 'การจัดการโพสต์', en: 'Moderation' },
  adminSubPrefix: { th: 'ลบโพสต์ที่ไม่เหมาะสมได้ทุกโพสต์ · ทั้งหมด', en: 'Remove any inappropriate post · total' },
  adminSubSuffix: { th: 'เหตุการณ์', en: 'posts' },
  justNow: { th: 'เมื่อสักครู่', en: 'just now' },
  minutesAgo: { th: 'นาทีที่แล้ว', en: 'min ago' },
  hoursAgo: { th: 'ชั่วโมงที่แล้ว', en: 'hr ago' },
  yesterday: { th: 'เมื่อวาน', en: 'yesterday' },
  daysAgo: { th: 'วันที่แล้ว', en: 'd ago' },
  weeksAgo: { th: 'สัปดาห์ที่แล้ว', en: 'wk ago' },
  ssoErrorState: { th: 'เซสชันเข้าสู่ระบบหมดอายุ ลองใหม่อีกครั้ง', en: 'Sign-in session expired — please try again.' },
  ssoErrorDomain: { th: 'ใช้ได้เฉพาะบัญชี @kmitl.ac.th เท่านั้น', en: 'Only @kmitl.ac.th accounts are allowed.' },
  ssoErrorExchange: { th: 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง', en: 'Sign-in failed — please try again.' },
  reactEncourage: { th: 'สู้ๆ นะ', en: 'Cheer up' },
  reactRelate: { th: 'เข้าใจเลย', en: 'Feel you' },
  reactCongrats: { th: 'ยินดีด้วย', en: 'Congrats' },
  reactHeart: { th: 'ส่งใจให้', en: 'Send love' },
  reactHug: { th: 'กอดๆ นะ', en: 'Hug' },
  reactHaha: { th: 'ฮาด้วย', en: 'Haha' },
  selfHarmTitle: { th: 'คุณโอเคไหมนะ?', en: 'Are you okay?' },
  selfHarmBody: {
    th: 'ขอบคุณที่กล้าพูดความรู้สึกออกมานะ คุณไม่ได้อยู่คนเดียว ข้อความแบบนี้ส่งลงฟีดไม่ได้ แต่มีคนที่พร้อมรับฟังคุณจริงๆ อยู่ตรงนี้',
    en: 'Thank you for opening up — you are not alone. This message cannot be posted here, but real people are ready to listen right now.',
  },
  selfHarmSos: { th: 'คุยกับ KMITL SOS', en: 'Talk to KMITL SOS' },
  selfHarmHotline: { th: 'โทร 1323 สายด่วนสุขภาพจิต (ฟรี 24 ชม.)', en: 'Call 1323 mental health hotline (free, 24/7)' },
  selfHarmClose: { th: 'เข้าใจแล้ว', en: 'Got it' },
  selfHarmError: {
    th: 'ข้อความนี้ส่งไม่ได้ — ถ้ารู้สึกแย่มากๆ โทร 1323 หรือเข้า sos.kmitl.ac.th ได้เลย',
    en: 'This message cannot be sent — if you are struggling, call 1323 or visit sos.kmitl.ac.th',
  },
  comments: { th: 'ความคิดเห็น', en: 'Comments' },
  commentPh: { th: 'ส่งกำลังใจให้หน่อย… (ไม่ระบุตัวตน)', en: 'Send some encouragement… (anonymous)' },
  send: { th: 'ส่ง', en: 'Send' },
  noComments: { th: 'ยังไม่มีความคิดเห็น เป็นคนแรกที่ให้กำลังใจเลย', en: 'No comments yet — be the first to cheer them up.' },
  toastCommented: { th: 'ส่งความคิดเห็นแล้ว', en: 'Comment sent' },
  toastCommentDeleted: { th: 'ลบความคิดเห็นแล้ว', en: 'Comment deleted' },
  profanityError: { th: 'ข้อความมีคำไม่เหมาะสม กรุณาแก้ไขก่อนโพสต์', en: 'Your post contains inappropriate language — please edit it first.' },
  errorGeneric: { th: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', en: 'Something went wrong. Please try again.' },
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
  const date = new Date(iso);
  const min = Math.floor((Date.now() - date.getTime()) / 60000);
  if (min < 1) return t('justNow', lang);
  if (min < 60) return `${min} ${t('minutesAgo', lang)}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ${t('hoursAgo', lang)}`;
  const day = Math.floor(hr / 24);
  if (day === 1) return t('yesterday', lang);
  if (day < 7) return `${day} ${t('daysAgo', lang)}`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} ${t('weeksAgo', lang)}`;
  return date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
