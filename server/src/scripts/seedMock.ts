// Mock feed data: ~250 unique Thai mood posts from a dozen mock students,
// spread over the last 14 days. Safe to re-run — mock users upsert by email
// and their old posts are replaced. Remove everything with:
//   Mood.deleteMany({author: {$in: mockIds}}) / User.deleteMany({email: /^mock68/})
// Run inside the app container: node dist/scripts/seedMock.js
import { Types } from 'mongoose';
import { connectDb, disconnectDb } from '../config/db.js';
import { Faculty } from '../models/Faculty.js';
import { User, type UserDoc } from '../models/User.js';
import { Mood, type MoodType } from '../models/Mood.js';
import { normalizeMajorDisplay, normalizeMajorKey } from '../lib/serialize.js';

const TARGET = 250;
const DAYS = 14;

// Deterministic PRNG so re-runs produce the same feed.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260716);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const BANKS: Record<MoodType, { a: string[]; b: string[] }> = {
  happy: {
    a: [
      'สอบผ่านวิชาที่ยากที่สุดของเทอม', 'ได้เกรดดีกว่าที่คิดไว้เยอะ', 'อาจารย์ชมงานหน้าชั้นเรียน',
      'ได้กินหมูกระทะกับแก๊งเพื่อน', 'โปรเจกต์ผ่านรีวิวรอบแรกแบบไม่มีแก้', 'ได้ทุนที่สมัครไว้',
      'เจอเพื่อนเก่าสมัยมัธยมที่โรงอาหาร', 'งานกลุ่มเสร็จก่อนกำหนดสองวัน', 'ตื่นทันคาบเช้าแบบไม่ต้องวิ่ง',
      'ได้ที่ฝึกงานที่เล็งไว้ตั้งแต่ปีหนึ่ง',
    ],
    b: [
      'ดีใจสุดๆ เลยวันนี้', 'ยิ้มทั้งวันไม่หยุดเลย', 'รู้สึกคุ้มกับที่พยายามมาตลอด',
      'อยากขอบคุณตัวเองมากๆ', 'เป็นวันที่ดีมากจริงๆ', 'พลังบวกเต็มหลอด',
      'หายเหนื่อยเป็นปลิดทิ้ง', 'โชคดีที่ไม่ยอมแพ้ไปก่อน',
    ],
  },
  hyped: {
    a: [
      'ทีมได้เข้ารอบชิงแฮ็กกาธอน', 'คอนเสิร์ตที่รอมาทั้งปีใกล้ถึงแล้ว', 'ได้ลองเครื่องมือใหม่ในแล็บ',
      'โปรเจกต์ส่วนตัวเริ่มเป็นรูปเป็นร่าง', 'กำลังจะไปค่ายกับชมรมสุดสัปดาห์นี้', 'ได้จับงานจริงกับรุ่นพี่ครั้งแรก',
      'อาจารย์ให้หัวข้อวิจัยที่อยากทำพอดี', 'เปิดรับสมัครแลกเปลี่ยนที่ญี่ปุ่นแล้ว',
    ],
    b: [
      'ตื่นเต้นจนนั่งไม่ติด', 'ไฟลุกสุดๆ', 'อะดรีนาลีนพุ่งมาก', 'พร้อมลุยเต็มที่แล้ว',
      'นอนไม่หลับเพราะตื่นเต้น', 'อยากให้ถึงวันนั้นไวๆ เลย',
    ],
  },
  meh: {
    a: [
      'วันนี้เรียนไปวันๆ', 'คาบบ่ายยาวเป็นพิเศษ', 'ไม่มีอะไรพิเศษเกิดขึ้นเลย',
      'กินข้าวเมนูเดิมเป็นวันที่สาม', 'รถติดเท่าเดิมเหมือนทุกวัน', 'งานเข้ามาเรื่อยๆ ในจังหวะเดิม',
      'นั่งอ่านสไลด์วนไปวนมา', 'ตารางเรียนแน่นเท่าเดิม',
    ],
    b: [
      'เฉยๆ กับทุกอย่างเลยช่วงนี้', 'ก็งั้นๆ อะ', 'รอวันศุกร์อย่างเดียว', 'ขอผ่านไปอีกวันก็พอ',
      'ไม่ได้แย่แต่ก็ไม่ได้ดี', 'ชีวิตนิ่งมากช่วงนี้',
    ],
  },
  tired: {
    a: [
      'อ่านหนังสือถึงตีสาม', 'ทำแล็บติดกันสามคาบ', 'งานกลุ่มสามวิชาชนกันพอดี',
      'เดินขึ้นตึกแปดชั้นเพราะลิฟต์เสีย', 'ติวให้เพื่อนมาทั้งคืน', 'ปั่นโปรเจกต์ข้ามคืนอีกแล้ว',
      'ซ้อมพรีเซนต์ทั้งวันจนเสียงแหบ', 'เลิกแล็บตอนสองทุ่มกว่า',
    ],
    b: [
      'เหนื่อยมากแต่ต้องไหว', 'อยากนอนยาวๆ สักวันเต็มๆ', 'ร่างพังมากช่วงนี้',
      'ขอกาแฟแก้วที่สามของวัน', 'หมดแรงสุดๆ', 'ไหล่กับหลังตึงไปหมดแล้ว',
    ],
  },
  stressed: {
    a: [
      'พรุ่งนี้สอบสองวิชาติดกัน', 'เดดไลน์โปรเจกต์ขยับเข้ามาอีก', 'โค้ดยังรันไม่ผ่านสักที',
      'อ่านหนังสือไม่ทันแน่ๆ รอบนี้', 'งานค้างกองเป็นภูเขาแล้ว', 'พรีเซนต์ใหญ่จ่ออาทิตย์หน้า',
      'เกรดเทอมนี้น่ากังวลมาก', 'หัวข้อโปรเจกต์ยังไม่ผ่านอาจารย์',
    ],
    b: [
      'เครียดจนกินข้าวไม่ค่อยลง', 'กดดันมากจริงๆ', 'สมองล้าไปหมดแล้ว',
      'ใจเต้นแรงทุกครั้งที่นึกถึง', 'ขอกำลังใจหน่อยนะ', 'หวังว่าจะผ่านรอบนี้ไปได้',
    ],
  },
  sad: {
    a: [
      'คะแนนสอบออกมาไม่ดีอย่างที่กลัว', 'โดนคอมเมนต์งานแรงมากวันนี้', 'คิดถึงบ้านมากเป็นพิเศษ',
      'เพื่อนสนิทย้ายคณะไปแล้ว', 'พลาดทุนที่ตั้งใจสมัครมาก', 'งานที่ทุ่มเทไปไม่ถูกเลือก',
      'ทะเลาะกับเพื่อนร่วมทีมเรื่องงาน', 'รู้สึกตามเพื่อนในห้องไม่ทัน',
    ],
    b: [
      'เศร้าจนไม่ค่อยอยากคุยกับใคร', 'ใจหายมากวันนี้', 'รู้สึกโดดเดี่ยวนิดหน่อย',
      'ขอเวลาซึมสักพักนะ', 'หวังว่าพรุ่งนี้จะดีขึ้น', 'อยากได้กำลังใจสักหน่อย',
    ],
  },
};

function buildPosts(): { moodType: MoodType; text: string }[] {
  const all: { moodType: MoodType; text: string }[] = [];
  for (const [moodType, bank] of Object.entries(BANKS) as [MoodType, { a: string[]; b: string[] }][]) {
    for (const a of bank.a) for (const b of bank.b) all.push({ moodType, text: `${a} ${b}` });
  }
  // Fisher–Yates with the seeded PRNG, then take the first TARGET unique texts.
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const seen = new Set<string>();
  return all.filter((p) => (seen.has(p.text) ? false : (seen.add(p.text), true))).slice(0, TARGET);
}

async function main(): Promise<void> {
  await connectDb();
  const faculties = await Faculty.find();
  if (faculties.length === 0) throw new Error('No faculties — run the main seed first');

  const users: UserDoc[] = [];
  for (let i = 1; i <= 12; i++) {
    const fac = pick(faculties);
    const majors: string[] = fac.knownMajors?.length ? fac.knownMajors : ['วิศวกรรมคอมพิวเตอร์'];
    const major = normalizeMajorDisplay(pick(majors));
    const email = `mock68${String(i).padStart(5, '0')}@kmitl.ac.th`;
    const user = await User.findOneAndUpdate(
      { email },
      {
        email,
        studentId: `68${String(i).padStart(5, '0')}`,
        displayName: `Mock Student ${i}`,
        faculty: fac._id,
        major,
        majorNormalized: normalizeMajorKey(major),
        year: 1 + Math.floor(rand() * 4),
        role: 'user',
        onboarded: true,
      },
      { upsert: true, new: true },
    );
    users.push(user);
  }

  const mockIds = users.map((u) => u._id);
  const removed = await Mood.deleteMany({ author: { $in: mockIds } });

  const now = Date.now();
  const docs = buildPosts().map((p) => {
    const author = pick(users);
    const created = new Date(
      now - Math.floor(rand() * DAYS) * 86_400_000 - Math.floor(rand() * 61_200_000) - 3_600_000,
    );
    return {
      _id: new Types.ObjectId(),
      author: author._id,
      moodType: p.moodType,
      text: p.text,
      faculty: author.faculty,
      major: author.major,
      majorNormalized: author.majorNormalized,
      year: author.year,
      createdAt: created,
      updatedAt: created,
      __v: 0,
    };
  });
  // insertMany on the raw collection so our historical createdAt survives
  // (mongoose timestamps would overwrite it with now).
  await Mood.collection.insertMany(docs);

  console.log(`mock users: ${users.length}, old mock posts removed: ${removed.deletedCount}, posts inserted: ${docs.length} across ${DAYS} days`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
