import { describe, expect, test } from 'bun:test';
import { getStack, getStacks, isAllowlistedUrl, docsForLibrary } from '../lib/registry.js';

describe('registry', () => {
  test('includes deep and thin stacks', () => {
    const stacks = getStacks();
    const ids = stacks.map((s) => s.id);
    expect(ids).toContain('hono');
    expect(ids).toContain('nextjs');
    expect(ids).toContain('express');
    expect(ids).toContain('fastapi');
    expect(ids).toContain('electron');
    expect(ids).toContain('universal');
  });

  test('hono is deep server stack, not bun+hono', () => {
    const hono = getStack('hono');
    expect(hono.platform).toBe('server');
    expect(hono.depth).toBe('deep');
    expect(hono.id).toBe('hono');
    expect(hono.standardsFile).toBe('hono.md');
  });

  test('allowlists official https docs URLs', () => {
    expect(isAllowlistedUrl('https://hono.dev/docs/')).toBe(true);
    expect(isAllowlistedUrl('https://evil.example/docs')).toBe(false);
    expect(isAllowlistedUrl('http://hono.dev/docs/')).toBe(false);
  });

  test('docsForLibrary maps known packages', () => {
    expect(docsForLibrary('zod')?.url).toContain('zod.dev');
    expect(docsForLibrary('totally-unknown-lib-xyz')).toBeNull();
  });
});
