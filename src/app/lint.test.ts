import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

describe('CI hook enforcement', () => {
  for (const filePath of ['src/ui/useKeyboard.ts', 'src/ui/SearchPanel.tsx']) {
    it(`rejects missing effect dependencies in ${filePath}`, async () => {
      const [result] = await eslint.lintText(`
        import { useEffect } from 'react';
        export function useExample(value: string) {
          useEffect(() => { document.title = value; }, []);
        }
      `, { filePath });
      expect(result.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: 'react-hooks/exhaustive-deps', severity: 2 }),
      ]));
    }, 15000);

    it(`rejects conditional hooks in ${filePath}`, async () => {
      const [result] = await eslint.lintText(`
        import { useEffect } from 'react';
        export function useExample(enabled: boolean) {
          if (enabled) useEffect(() => { document.title = 'example'; }, []);
        }
      `, { filePath });
      expect(result.messages).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: 'react-hooks/rules-of-hooks', severity: 2 }),
      ]));
    }, 15000);
  }
});
