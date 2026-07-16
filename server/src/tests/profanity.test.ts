import { describe, expect, it } from 'vitest';
import { containsHarm, containsProfanity, containsSelfHarm } from '../lib/profanity.js';

describe('containsProfanity', () => {
  it('flags Thai profanity, incl. repeated-char obfuscation', () => {
    expect(containsProfanity('วันนี้เหี้ยมาก')).toBe(true);
    expect(containsProfanity('เหี้ยยยยยย')).toBe(true);
    expect(containsProfanity('อีดอกเอ๊ย')).toBe(true);
    expect(containsProfanity('สัสจริง')).toBe(true);
    expect(containsProfanity('ระยำจริงๆ')).toBe(true); // ำ NFKC-decomposes — lists must be normalized
    expect(containsProfanity('หีอะไรวะ')).toBe(true);
  });

  it('flags English profanity, incl. leetspeak and stretched letters', () => {
    expect(containsProfanity('what the fuck')).toBe(true);
    expect(containsProfanity('fuuuuck this exam')).toBe(true);
    expect(containsProfanity('sh1t happens')).toBe(true);
    expect(containsProfanity('FUCK')).toBe(true);
  });

  it('does not flag clean text or lookalike words', () => {
    expect(containsProfanity('วันนี้มีความสุขมาก')).toBe(false);
    expect(containsProfanity('เก็บของใส่หีบเรียบร้อย')).toBe(false); // หีบ ≠ หี
    expect(containsProfanity('my class assignment is done')).toBe(false); // ass inside words
    expect(containsProfanity('the assistant helped a lot')).toBe(false);
    expect(containsProfanity('สอบ Circuit Analysis ยากมาก')).toBe(false);
    expect(containsProfanity('ดอกไม้เหี่ยวเฉา')).toBe(false); // เหี่ยว ≠ เหี่ย
    expect(containsProfanity('สัดส่วนร่างกาย')).toBe(false);
    expect(containsProfanity('บ้านอยู่ห่างมหาลัย')).toBe(false);
  });

  it('catches separator-obfuscated Thai and expanded lists', () => {
    expect(containsProfanity('เ หี้ ย')).toBe(true);
    expect(containsProfanity('ค.ว.ย')).toBe(true);
    expect(containsProfanity('ตอแหลชัดๆ')).toBe(true);
    expect(containsProfanity('เกรดออกมาชิบหายเลย')).toBe(true);
    expect(containsProfanity('what a dumbass')).toBe(true);
  });
});

describe('containsSelfHarm / containsHarm', () => {
  it('flags self-harm expressions (TH + EN)', () => {
    expect(containsSelfHarm('อยากตาย')).toBe(true);
    expect(containsSelfHarm('ไม่อยากอยู่แล้ว')).toBe(true);
    expect(containsSelfHarm('i want to die')).toBe(true);
    expect(containsSelfHarm('kms')).toBe(true);
  });

  it('flags hostile phrases', () => {
    expect(containsHarm('ไปตาย')).toBe(true);
    expect(containsHarm('kys')).toBe(true);
    expect(containsHarm('สมน้ำหน้า')).toBe(true);
    expect(containsHarm('อ่อนแอก็แพ้ไป')).toBe(true);
    expect(containsHarm('go rot in hell')).toBe(true);
  });

  it('flags expanded self-harm phrases incl. apostrophes', () => {
    expect(containsSelfHarm("i don't want to live")).toBe(true);
    expect(containsSelfHarm('อยากโดดตึก')).toBe(true);
    expect(containsSelfHarm('เหนื่อยจนไม่อยากหายใจ')).toBe(true);
  });

  it('does not flag ordinary sadness or empathy', () => {
    expect(containsSelfHarm('เหนื่อยมาก ท้อสุดๆ')).toBe(false);
    expect(containsSelfHarm('เศร้าจัง สอบตก')).toBe(false);
    expect(containsHarm('สู้ๆ นะ เป็นกำลังใจให้')).toBe(false);
  });
});
