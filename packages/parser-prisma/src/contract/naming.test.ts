import { describe, expect, it } from 'vitest';
import { PrismaEntityCollisionError } from '../errors.js';
import { resolveNames } from './naming.js';

describe('resolveNames', () => {
  const models = [
    { namespace: 'public', name: 'User' },
    { namespace: 'billing', name: 'User' },
  ];

  it('gives rename precedence over namespace prefix', () => {
    expect(
      resolveNames(models, {
        namespacePrefix: { billing: 'Billing' },
        rename: { 'public.User': 'Account' },
      }),
    ).toEqual(
      new Map([
        ['public.User', 'Account'],
        ['billing.User', 'BillingUser'],
      ]),
    );
  });

  it('rejects collisions after resolution', () => {
    expect(() =>
      resolveNames(models, { rename: { 'billing.User': 'User' } }),
    ).toThrow(PrismaEntityCollisionError);
  });
});
