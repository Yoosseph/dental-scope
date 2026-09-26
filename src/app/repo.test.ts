import { describe, expect, it } from 'vitest';
import { parseRepoUrl } from './repo';

describe('parseRepoUrl', () => {
  it('is null when unset or blank, so a private repo is never linked by default', () => {
    expect(parseRepoUrl(undefined)).toBeNull();
    expect(parseRepoUrl('')).toBeNull();
    expect(parseRepoUrl('   ')).toBeNull();
  });
  it('accepts an https URL', () => {
    expect(parseRepoUrl('https://github.com/Yoosseph/dental-scope')).toBe('https://github.com/Yoosseph/dental-scope');
    expect(parseRepoUrl(' https://github.com/Yoosseph/dental-scope ')).toBe('https://github.com/Yoosseph/dental-scope');
  });
  it('rejects anything that is not an https URL', () => {
    expect(parseRepoUrl('off')).toBeNull();
    expect(parseRepoUrl('javascript:alert(1)')).toBeNull();
    expect(parseRepoUrl('http://github.com/x/y')).toBeNull();
  });
});
