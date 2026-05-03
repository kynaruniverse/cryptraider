// ============================================================
// CRYPT RAIDER — Level Code System
// Generates & validates alphanumeric codes per level
// Format: 6-character uppercase code
// ============================================================

import { CODE_SALT, CONFIG } from '../engine/constants.js';

/**
 * Generates a deterministic 6-character code for a given level index.
 * Uses an FNV-1a inspired hash to ensure distribution.
 * @param {number} levelIndex 
 * @returns {string} 6-char code
 */
export function generateCode(levelIndex) {
  // Ensure levelIndex is treated as an integer
  const idx = Math.floor(levelIndex);
  const raw = `${CODE_SALT || 'CR-V2'}-${idx}`;

  let hash = 0x811c9dc5; // FNV offset basis

  // Hash the string
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0; // FNV prime
  }

  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, I, 1, 0 confusion
  let code = '';
  let h = hash;

  for (let i = 0; i < 6; i++) {
    code += CHARS[h % CHARS.length];
    
    // Mix the bits for the next character slot
    // We use an XOR shift to ensure the 6 characters aren't too similar
    h = (h >>> 5) ^ (h << 2);
    h = h >>> 0; // Maintain unsigned 32-bit
  }

  return code;
}

/**
 * Checks a user-input code against all possible levels (0-100).
 * @param {string} input 
 * @returns {number} Level index or -1 if invalid
 */
export function validateCode(input) {
  if (!input || typeof input !== 'string') return null;

  // Remove anything that isn't a letter or number (e.g., accidental hyphens or dots)
  const clean = input.toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (clean.length !== 6) return null;


  for (let lvl = 0; lvl < CONFIG.TOTAL_LEVELS; lvl++) {
    if (generateCode(lvl) === clean) return { level: lvl + 1, index: lvl };
  }

  return null; // Invalid code
}

/**
 * Utility to generate a map of all codes for reference.
 * Useful for debugging or providing a 'password' sheet.
 */
export function getAllCodes() {
  return Array.from({ length: CONFIG.TOTAL_LEVELS }, (_, i) => ({
    level: i + 1,
    code:  generateCode(i),
  }));
}
