import { describe, expect, it } from 'vitest';
import { containsProfanity } from '../lib/profanity.js';

describe('containsProfanity', () => {
  it('flags Thai profanity, incl. repeated-char obfuscation', () => {
    expect(containsProfanity('วันนี้เหี้ยมาก')).toBe(true);
    expect(containsProfanity('เหี้ยยยยยย')).toBe(true);
    expect(containsProfanity('อีดอกเอ๊ย')).toBe(true);
    expect(containsProfanity('สัสจริง')).toBe(true);
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
  });
});
