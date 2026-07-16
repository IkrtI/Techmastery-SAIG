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
import { Comment } from '../models/Comment.js';
import { Reaction, REACTION_TYPES } from '../models/Reaction.js';
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
  // Real student faculties only: has a code, has curricula, not the staff entry.
  const pool = faculties.filter((f) => f.code && f.slug !== 'staff' && (f.knownMajors?.length ?? 0) > 0);
  if (pool.length === 0) throw new Error('No seeded faculties with majors — run the main seed first');

  // Wipe previous mock generations entirely (users, posts, engagement).
  const oldMocks = await User.find({ email: /^mock/ });
  const oldIds = oldMocks.map((u) => u._id);
  const oldPostIds = (await Mood.find({ author: { $in: oldIds } }).select('_id')).map((m) => m._id);
  const [removed] = await Promise.all([
    Mood.deleteMany({ _id: { $in: oldPostIds } }),
    Comment.deleteMany({ $or: [{ post: { $in: oldPostIds } }, { author: { $in: oldIds } }] }),
    Reaction.deleteMany({ $or: [{ post: { $in: oldPostIds } }, { user: { $in: oldIds } }] }),
    User.deleteMany({ _id: { $in: oldIds } }),
  ]);

  const users: UserDoc[] = [];
  for (let i = 1; i <= 12; i++) {
    const fac = pick(pool);
    // Major always comes from the faculty's own curricula, and the student ID
    // embeds the faculty code (digits 3-4) like real KMITL IDs.
    const major = normalizeMajorDisplay(pick(fac.knownMajors));
    const studentId = `68${fac.code}${String(i).padStart(4, '0')}`;
    const email = `mock${studentId}@kmitl.ac.th`;
    const user = await User.create({
      email,
      studentId,
      displayName: `Mock Student ${i}`,
      faculty: fac._id,
      major,
      majorNormalized: normalizeMajorKey(major),
      year: 1 + Math.floor(rand() * 4),
      role: 'user',
      onboarded: true,
    });
    users.push(user);
  }

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

  // Sprinkle engagement on a fraction of posts — not all, like a real feed.
  const ENCOURAGEMENTS = [
    'สู้ๆ นะ เป็นกำลังใจให้', 'เข้าใจความรู้สึกเลย เคยผ่านมาก่อน', 'เก่งมากแล้ววันนี้',
    'พักผ่อนเยอะๆ นะ', 'ยินดีด้วยนะ เก่งมาก', 'เดี๋ยวมันก็ผ่านไป สู้ๆ',
    'ขอให้พรุ่งนี้เป็นวันที่ดีนะ', 'อย่าลืมดูแลตัวเองด้วยนะ', 'เป็นกำลังใจให้เสมอเลย',
    'รู้สึกเหมือนกันเลยช่วงนี้', 'เก็บแรงไว้สู้ต่อนะ', 'ภูมิใจในตัวเองได้เลย',
  ];
  const reactionDocs = [];
  const commentDocs = [];
  for (const d of docs) {
    if (rand() < 0.45) {
      const n = 1 + Math.floor(rand() * 4);
      const others = users.filter((u) => !u._id.equals(d.author));
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      for (const u of others.slice(0, n)) {
        reactionDocs.push({
          _id: new Types.ObjectId(),
          post: d._id,
          user: u._id,
          type: REACTION_TYPES[Math.floor(rand() * REACTION_TYPES.length)],
          createdAt: d.createdAt,
          updatedAt: d.createdAt,
          __v: 0,
        });
      }
    }
    if (rand() < 0.3) {
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const u = pick(users);
        if (u._id.equals(d.author)) continue;
        const at = new Date(d.createdAt.getTime() + 60_000 + Math.floor(rand() * 3_000_000));
        commentDocs.push({
          _id: new Types.ObjectId(),
          post: d._id,
          author: u._id,
          text: pick(ENCOURAGEMENTS),
          faculty: u.faculty,
          year: u.year,
          createdAt: at,
          updatedAt: at,
          __v: 0,
        });
      }
    }
  }
  if (reactionDocs.length > 0) await Reaction.collection.insertMany(reactionDocs);
  if (commentDocs.length > 0) await Comment.collection.insertMany(commentDocs);

  console.log(
    `mock users: ${users.length}, old mock posts removed: ${removed.deletedCount}, posts inserted: ${docs.length} across ${DAYS} days, reactions: ${reactionDocs.length}, comments: ${commentDocs.length}`,
  );
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
