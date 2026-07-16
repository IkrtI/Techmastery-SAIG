// Idempotent seed: faculties (upsert by slug) + admin role sync for existing
// users in SEED_ADMIN_EMAILS. Never creates partial User documents (SPECS §8).
import { loadEnv } from '../config/env.js';
import { connectDb, disconnectDb } from '../config/db.js';
import { Faculty } from '../models/Faculty.js';
import { User } from '../models/User.js';

interface FacultySeed {
  slug: string;
  code: string;
  nameTh: string;
  nameEn: string;
  knownMajors?: string[];
}

// Official KMITL faculty catalog (reg.kmitl curriculum data). `code` matches
// digits 3-4 of student IDs; knownMajors are the bachelor curricula.
const FACULTIES: FacultySeed[] = [
  {
    slug: 'engineering',
    code: '01',
    nameTh: 'คณะวิศวกรรมศาสตร์',
    nameEn: 'Faculty of Engineering',
    knownMajors: [
      'วิศวกรรมคอมพิวเตอร์', 'วิศวกรรมคอมพิวเตอร์และความปลอดภัยไซเบอร์', 'วิศวกรรมไฟฟ้า',
      'วิศวกรรมเครื่องกล', 'วิศวกรรมโยธา', 'วิศวกรรมเคมี', 'วิศวกรรมอิเล็กทรอนิกส์',
      'วิศวกรรมอุตสาหการ', 'วิศวกรรมอาหาร', 'วิศวกรรมเซมิคอนดักเตอร์', 'วิศวกรรมออโตเมชัน',
      'วิศวกรรมขนส่งทางราง', 'วิศวกรรมเกษตรอัจฉริยะ', 'วิศวกรรมการผลิตเชิงบูรณาการ',
      'วิศวกรรมไฟฟ้าสื่อสารและเครือข่าย', 'วิศวกรรมเมคคาทรอนิกส์และระบบวัดคุม',
      'วิศวกรรมอวกาศและภูมิสารสนเทศ', 'วิศวกรรมไอโอทีและสารสนเทศ',
      'วิศวกรรมคอมพิวเตอร์ (หลักสูตรนานาชาติ)', 'วิศวกรรมซอฟต์แวร์ (หลักสูตรนานาชาติ)',
      'วิศวกรรมหุ่นยนต์และปัญญาประดิษฐ์ (หลักสูตรนานาชาติ)',
      'วิศวกรรมปัญญาประดิษฐ์และการเป็นผู้ประกอบการ (หลักสูตรนานาชาติ)',
      'วิศวกรรมการเงิน (หลักสูตรนานาชาติ)', 'วิศวกรรมชีวการแพทย์ (หลักสูตรนานาชาติ)',
      'วิศวกรรมเครื่องกล (หลักสูตรนานาชาติ)', 'วิศวกรรมไฟฟ้า (หลักสูตรนานาชาติ)',
      'วิศวกรรมพลังงาน (หลักสูตรนานาชาติ)', 'วิศวกรรมโยธา (หลักสูตรนานาชาติ)',
      'วิศวกรรมแมคคาทรอนิกส์ (หลักสูตรนานาชาติ)',
      'วิศวกรรมอุตสาหการและการจัดการโลจิสติกส์ (หลักสูตรนานาชาติ)',
      'วิศวกรรมการวัดคุม (ต่อเนื่อง)', 'วิศวกรรมคอมพิวเตอร์และไอโอที (ต่อเนื่อง)',
      'วิศวกรรมไฟฟ้า (ต่อเนื่อง)', 'วิศวกรรมไฟฟ้าสื่อสารและอิเล็กทรอนิกส์ (ต่อเนื่อง)',
      'วิศวกรรมโยธา (ต่อเนื่อง)', 'วิศวกรรมระบบอุตสาหกรรมการเกษตร (ต่อเนื่อง)',
    ],
  },
  {
    slug: 'architecture',
    code: '02',
    nameTh: 'คณะสถาปัตยกรรม ศิลปะและการออกแบบ',
    nameEn: 'School of Architecture, Art, and Design',
    knownMajors: [
      'สถาปัตยกรรมหลัก', 'สถาปัตยกรรมภายใน', 'สถาปัตยกรรม (หลักสูตรนานาชาติ)', 'ภูมิสถาปัตยกรรม',
      'ศิลปอุตสาหกรรม', 'นิเทศศิลป์', 'การถ่ายภาพ', 'ภาพยนตร์และดิจิทัลมีเดีย',
      'ศิลปกรรม มีเดียอาร์ต และอิลลัสเตชันอาร์ต', 'การออกแบบประสบการณ์สำหรับสื่อบูรณาการ',
      'ปัญญาออกแบบเพื่อเศรษฐกิจสร้างสรรค์ (หลักสูตรนานาชาติ)',
    ],
  },
  {
    slug: 'industrial-education',
    code: '03',
    nameTh: 'คณะครุศาสตร์อุตสาหกรรมและเทคโนโลยี',
    nameEn: 'School of Industrial Education and Technology',
    knownMajors: [
      'ครุศาสตร์เกษตร', 'การออกแบบสภาพแวดล้อมภายใน', 'เทคโนโลยีคอมพิวเตอร์',
      'นวัตกรรมและเทคโนโลยีการออกแบบ', 'วิทยาการจัดการเรียนรู้', 'อิเล็กทรอนิกส์และโทรคมนาคม',
      'เทคโนโลยีบัณฑิต (บูรณาการนวัตกรรมเพื่อสินค้าและบริการ)', 'เทคโนโลยีอิเล็กทรอนิกส์ (ต่อเนื่อง)',
    ],
  },
  {
    slug: 'agricultural-technology',
    code: '04',
    nameTh: 'คณะเทคโนโลยีการเกษตร',
    nameEn: 'School of Agricultural Technology',
    knownMajors: [
      'การจัดการสมาร์ตฟาร์ม', 'เทคโนโลยีการผลิตพืช', 'นวัตกรรมพืชสวน', 'สัตวศาสตร์',
      'การพยาบาลสัตว์และการจัดการธุรกิจสัตว์เลี้ยง', 'นิเทศศาสตร์เกษตร',
      'นวัตกรรมการผลิตสัตว์น้ำและการจัดการทรัพยากรประมง', 'เศรษฐศาสตร์และธุรกิจเพื่อพัฒนาการเกษตร',
    ],
  },
  {
    slug: 'science',
    code: '05',
    nameTh: 'คณะวิทยาศาสตร์',
    nameEn: 'School of Science',
    knownMajors: [
      'วิทยาการคอมพิวเตอร์', 'คณิตศาสตร์ประยุกต์', 'สถิติประยุกต์และการวิเคราะห์ข้อมูล',
      'เคมีอุตสาหกรรม', 'จุลชีววิทยาอุตสาหกรรม', 'เทคโนโลยีชีวภาพอุตสาหกรรม', 'ฟิสิกส์อุตสาหกรรม',
      'เทคโนโลยีสิ่งแวดล้อมและการจัดการอย่างยั่งยืน',
      'เทคโนโลยีดิจิทัลและนวัตกรรมเชิงบูรณาการ (หลักสูตรนานาชาติ)',
    ],
  },
  {
    slug: 'food-industry',
    code: '06',
    nameTh: 'คณะอุตสาหกรรมอาหาร',
    nameEn: 'School of Food Industry',
    knownMajors: ['วิทยาศาสตร์และเทคโนโลยีการอาหาร', 'วิศวกรรมแปรรูปอาหาร'],
  },
  {
    slug: 'it',
    code: '07',
    nameTh: 'คณะเทคโนโลยีสารสนเทศ',
    nameEn: 'School of Information Technology',
    knownMajors: ['เทคโนโลยีสารสนเทศ', 'เทคโนโลยีปัญญาประดิษฐ์', 'วิทยาการข้อมูลและการวิเคราะห์เชิงธุรกิจ'],
  },
  {
    slug: 'business',
    code: '12',
    nameTh: 'คณะบริหารธุรกิจ',
    nameEn: 'KMITL Business School',
    knownMajors: [
      'บริหารธุรกิจ', 'บริหารธุรกิจ (นานาชาติ)', 'เศรษฐศาสตร์ธุรกิจและการจัดการ',
      'การเปลี่ยนแปลงทางดิจิทัลและการจัดการเทคโนโลยี', 'การเป็นผู้ประกอบการระดับโลก (หลักสูตรนานาชาติ)',
    ],
  },
  {
    slug: 'aviation',
    code: '14',
    nameTh: 'วิทยาลัยอุตสาหกรรมการบินนานาชาติ',
    nameEn: 'International Academy of Aviation Industry',
    knownMajors: [
      'วิศวกรรมการบินและนักบินพาณิชย์ (หลักสูตรนานาชาติ)', 'วิศวกรรมการบินและอวกาศ (หลักสูตรนานาชาติ)',
      'การจัดการโลจิสติกส์ (หลักสูตรนานาชาติ)',
    ],
  },
  {
    slug: 'liberal-arts',
    code: '15',
    nameTh: 'คณะศิลปศาสตร์',
    nameEn: 'School of Liberal Arts',
    knownMajors: [
      'ภาษาอังกฤษ', 'ภาษาจีนเพื่ออุตสาหกรรม', 'ภาษาญี่ปุ่นธุรกิจ', 'การจัดการบริการการบิน',
      'นวัตกรรมการท่องเที่ยวและการบริการ',
    ],
  },
  {
    slug: 'medicine',
    code: '16',
    nameTh: 'คณะแพทยศาสตร์',
    nameEn: 'Faculty of Medicine',
    knownMajors: ['แพทยศาสตร์ (หลักสูตรนานาชาติ)'],
  },
  {
    slug: 'innovation-management',
    code: '17',
    nameTh: 'คณะการจัดการนวัตกรรมและอุตสาหกรรม',
    nameEn: 'Innovation and Industrial Management',
    knownMajors: ['การจัดการนวัตกรรมและอุตสาหกรรม'],
  },
  {
    slug: 'music-engineering',
    code: '18',
    nameTh: 'วิทยาลัยวิศวกรรมสังคีต',
    nameEn: 'Institute of Music Science and Engineering',
    knownMajors: ['วิศวกรรมดนตรีและสื่อประสม', 'เทคโนโลยีและศิลปะสร้างสรรค์'],
  },
  {
    slug: 'dentistry',
    code: '19',
    nameTh: 'คณะทันตแพทยศาสตร์',
    nameEn: 'Faculty of Dentistry',
    knownMajors: ['ทันตแพทยศาสตร์ (หลักสูตรนานาชาติ)'],
  },
  {
    slug: 'chumphon',
    code: '20',
    nameTh: 'วิทยาเขตชุมพรเขตรอุดมศักดิ์',
    nameEn: 'Prince of Chumphon Campus',
    knownMajors: [
      'วิศวกรรมคอมพิวเตอร์', 'วิศวกรรมเครื่องกล', 'วิศวกรรมไฟฟ้า', 'วิศวกรรมโยธา',
      'วิศวกรรมหุ่นยนต์และอิเล็กทรอนิกส์', 'วิศวกรรมอุตสาหการและการผลิต',
      'เทคโนโลยีการจัดการผลิตพืช', 'นวัตกรรมอาหารและการจัดการ',
      'บริหารธุรกิจและการเป็นผู้ประกอบการ', 'วิทยาศาสตร์การประมงและทรัพยากรทางน้ำ', 'สัตวศาสตร์',
    ],
  },
  {
    slug: 'kosen',
    code: '21',
    nameTh: 'สถาบันโคเซ็นแห่ง สจล.',
    nameEn: 'KOSEN-KMITL',
    knownMajors: ['วิศวกรรมนวัตกรรมขั้นสูง (ต่อเนื่อง)'],
  },
  {
    slug: 'nursing',
    code: '22',
    nameTh: 'คณะพยาบาลศาสตร์',
    nameEn: 'Faculty of Nursing Science',
    knownMajors: ['พยาบาลศาสตร์'],
  },
  {
    slug: 'ami',
    code: '23',
    nameTh: 'วิทยาลัยเทคโนโลยีนวัตกรรมบูรณาการ',
    nameEn: 'Integrated Innovative Technology',
    knownMajors: ['วิศวกรรมระบบการผลิต', 'วิศวกรรมวัสดุนาโน'],
  },
  {
    slug: 'exchange',
    code: '95',
    nameTh: 'นักศึกษาแลกเปลี่ยน',
    nameEn: 'International Exchange Student',
    knownMajors: ['นักศึกษาแลกเปลี่ยน'],
  },
  {
    slug: 'staff',
    code: '99',
    nameTh: 'เจ้าหน้าที่ สจล.',
    nameEn: 'KMITL Staff',
    knownMajors: ['เจ้าหน้าที่'],
  },
];

export async function runSeed(): Promise<void> {
  for (const f of FACULTIES) {
    await Faculty.updateOne(
      { slug: f.slug },
      { $set: { nameTh: f.nameTh, nameEn: f.nameEn, code: f.code, knownMajors: f.knownMajors ?? [] } },
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
