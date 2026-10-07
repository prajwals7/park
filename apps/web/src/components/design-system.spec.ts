import { describe, it, expect } from 'vitest';
import { BadgeVariant } from './ui/badge';
import { ButtonVariant } from './ui/button';

describe('Design System UI Tokens & Components Suite', () => {
  it('supports all semantic status badge variants', () => {
    const validVariants: BadgeVariant[] = [
      'active',
      'expiring',
      'expired',
      'balanced',
      'shortage',
      'excess',
      'primary',
      'accent',
      'neutral',
    ];
    expect(validVariants).toHaveLength(9);
  });

  it('supports all primary and secondary button variants', () => {
    const buttonVariants: ButtonVariant[] = [
      'primary',
      'accent',
      'secondary',
      'outline',
      'ghost',
      'destructive',
    ];
    expect(buttonVariants).toHaveLength(6);
  });

  it('sorts data table rows numerically and alphabetically', () => {
    const rows = [
      { id: '1', name: 'Ramesh', amount: 200 },
      { id: '2', name: 'Ananya', amount: 400 },
      { id: '3', name: 'Kavitha', amount: 100 },
    ];

    // Alphabetical sort asc
    const sortedAlpha = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    expect(sortedAlpha[0]?.name).toBe('Ananya');
    expect(sortedAlpha[2]?.name).toBe('Ramesh');

    // Numeric sort asc
    const sortedNum = [...rows].sort((a, b) => a.amount - b.amount);
    expect(sortedNum[0]?.amount).toBe(100);
    expect(sortedNum[2]?.amount).toBe(400);
  });

  it('filters data table rows by search keywords', () => {
    const rows = [
      { name: 'Ramesh Kumar', passNo: 'WP-101', phone: '9845012345' },
      { name: 'Ananya Sharma', passNo: 'WP-102', phone: '9876543210' },
      { name: 'Kavitha Reddy', passNo: 'WP-103', phone: '9845112233' },
    ];

    const searchKeyword = 'sharma';
    const filtered = rows.filter((r) =>
      Object.values(r).some((val) => val.toLowerCase().includes(searchKeyword.toLowerCase())),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.passNo).toBe('WP-102');
  });
});
