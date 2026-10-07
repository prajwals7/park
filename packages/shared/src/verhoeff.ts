// Verhoeff checksum algorithm for Indian Aadhaar validation
// Table d: multiplication table
const d: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Table p: permutation table
const p: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

// Table inv: inverse table
const inv: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export class VerhoeffUtil {
  /**
   * Validates whether a number string satisfies the Verhoeff checksum algorithm
   */
  static validate(numStr: string): boolean {
    const clean = numStr.replace(/\s+/g, '');
    if (!/^\d+$/.test(clean)) return false;

    let c = 0;
    const reversed = clean.split('').reverse().map(Number);

    for (let i = 0; i < reversed.length; i++) {
      const num = reversed[i]!;
      c = d[c]![p[i % 8]![num]!]!;
    }

    return c === 0;
  }

  /**
   * Computes the checksum digit for a given base number string
   */
  static generateChecksum(baseStr: string): number {
    const clean = baseStr.replace(/\s+/g, '');
    let c = 0;
    const reversed = clean.split('').reverse().map(Number);

    for (let i = 0; i < reversed.length; i++) {
      const num = reversed[i]!;
      c = d[c]![p[(i + 1) % 8]![num]!]!;
    }

    return inv[c]!;
  }
}
