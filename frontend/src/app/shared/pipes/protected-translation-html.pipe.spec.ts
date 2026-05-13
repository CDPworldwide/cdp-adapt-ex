import { protectTranslationHtml } from './protected-translation-html.pipe';

describe('protectTranslationHtml', () => {
  it('wraps acronym tokens with translate=no spans', () => {
    expect(protectTranslationHtml('M.O.S.E. and HVAC/CDP with CO2 and PM2.5')).toBe(
      '<span translate="no" class="notranslate">M.O.S.E.</span> and ' +
        '<span translate="no" class="notranslate">HVAC/CDP</span> with ' +
        '<span translate="no" class="notranslate">CO2</span> and ' +
        '<span translate="no" class="notranslate">PM2.5</span>',
    );
  });

  it('escapes text before adding protection spans', () => {
    expect(protectTranslationHtml('EPA <script>alert("x")</script>')).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('does not over-wrap all-caps phrases without lowercase context', () => {
    expect(protectTranslationHtml('CONSTRUCTION DE FOURRIERE MODERNE')).toBe(
      'CONSTRUCTION DE FOURRIERE MODERNE',
    );
  });
});
