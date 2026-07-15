// Idempotent seed: faculties (upsert by slug) + admin role sync for existing
// users in SEED_ADMIN_EMAILS. Never creates partial User documents (SPECS §8).
import { loadEnv } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';

interface FacultySeed {
  slug: string;
  nameTh: string;
  nameEn: string;
  knownMajors?: string[];
}

// Best-effort public faculty list — adjust here, not in SPECS.
const FACULTIES: FacultySeed[] = [
  {
    slug: 'engineering',
    nameTh: 'คณะวิศวกรรมศาสตร์',
    nameEn: 'Faculty of Engineering',
    knownMajors: [
      'วิศวกรรมคอมพิวเตอร์',
      'วิศวกรรมไฟฟ้า',
      'วิศวกรรมเครื่องกล',
      'วิศวกรรมโยธา',
      'วิศวกรรมเคมี',
      'วิศวกรรมโทรคมนาคม',
      'Software Engineering (SIIE)',
      'วิศวกรรมหุ่นยนต์และปัญญาประดิษฐ์',
    ],
  },
  { slug: 'architecture', nameTh: 'คณะสถาปัตยกรรม ศิลปะและการออกแบบ', nameEn: 'School of Architecture, Art, and Design' },
  {
    slug: 'science',
    nameTh: 'คณะวิทยาศาสตร์',
    nameEn: 'School of Science',
    knownMajors: ['คณิตศาสตร์ประยุกต์', 'วิทยาการคอมพิวเตอร์', 'เคมี', 'ฟิสิกส์', 'จุลชีววิทยา', 'สถิติ'],
  },
  { slug: 'industrial-education', nameTh: 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี', nameEn: 'School of Industrial Education and Technology' },
  { slug: 'agricultural-technology', nameTh: 'คณะเทคโนโลยีการเกษตร', nameEn: 'School of Agricultural Technology' },
  { slug: 'food-industry', nameTh: 'คณะอุตสาหกรรมอาหาร', nameEn: 'School of Food Industry' },
  {
    slug: 'it',
    nameTh: 'คณะเทคโนโลยีสารสนเทศ',
    nameEn: 'School of Information Technology',
    knownMajors: ['เทคโนโลยีสารสนเทศ', 'วิทยาการข้อมูลและการวิเคราะห์เชิงธุรกิจ', 'เทคโนโลยีสารสนเทศทางธุรกิจ (BIT)'],
  },
  { slug: 'business', nameTh: 'คณะบริหารธุรกิจ', nameEn: 'KMITL Business School' },
  { slug: 'liberal-arts', nameTh: 'คณะศิลปศาสตร์', nameEn: 'School of Liberal Arts' },
  { slug: 'medicine', nameTh: 'คณะแพทยศาสตร์', nameEn: 'Faculty of Medicine' },
  { slug: 'dentistry', nameTh: 'คณะทันตแพทยศาสตร์', nameEn: 'Faculty of Dentistry' },
  { slug: 'nursing', nameTh: 'คณะพยาบาลศาสตร์', nameEn: 'Faculty of Nursing' },
  { slug: 'aviation', nameTh: 'วิทยาลัยอุตสาหกรรมการบินนานาชาติ', nameEn: 'International Academy of Aviation Industry' },
  { slug: 'ami', nameTh: 'วิทยาลัยนวัตกรรมการผลิตขั้นสูง', nameEn: 'College of Advanced Manufacturing Innovation' },
  { slug: 'music-engineering', nameTh: 'วิทยาลัยวิศวกรรมสังคีต', nameEn: 'Institute of Music Science and Engineering' },
  { slug: 'chumphon', nameTh: 'วิทยาเขตชุมพรเขตรอุดมศักดิ์', nameEn: 'Prince of Chumphon Campus' },
];

export async function runSeed(): Promise<void> {
  for (const f of FACULTIES) {
    await Faculty.updateOne(
      { slug: f.slug },
      { $set: { nameTh: f.nameTh, nameEn: f.nameEn, knownMajors: f.knownMajors ?? [] } },
      { upsert: true },
    );
  }
  const { env } = await import('../config/env.js');
  const admins = env().SEED_ADMIN_EMAILS;
  if (admins.length > 0) {
    await User.updateMany({ email: { $in: admins } }, { $set: { role: 'admin' } });
  }
}

const isMain = process.argv[1] ? import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href : false;
if (isMain) {
  loadEnv();
  await connectDb();
  await runSeed();
  const count = await Faculty.countDocuments();
  console.log(`Seed complete — ${count} faculties.`);
  await disconnectDb();
}
