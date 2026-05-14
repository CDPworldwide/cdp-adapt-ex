import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const ACRONYM_PATTERN =
  /\b(?:[A-Za-z]{1,2}\.)+[A-Za-z]\.?(?=\W|$)|\b(?=[A-Z0-9/.+-]{2,}\b)(?=[A-Z0-9/.+-]*[A-Z])[A-Z0-9]+(?:[/-][A-Z0-9]+)*(?:\.[0-9]+)?\b/g;
const LOWERCASE_PATTERN = /[a-z]/;
const UPPERCASE_WORD_PATTERN = /\b[A-Z]{2,}\b/g;

@Pipe({
  name: 'protectedTranslationHtml',
  standalone: true,
  pure: true,
})
export class ProtectedTranslationHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    return this.sanitizer.bypassSecurityTrustHtml(protectTranslationHtml(value));
  }
}

export function protectTranslationHtml(value: string): string {
  const hasLowercase = LOWERCASE_PATTERN.test(value);
  const uppercaseWordCount = value.match(UPPERCASE_WORD_PATTERN)?.length ?? 0;
  let result = '';
  let lastIndex = 0;

  value.replace(ACRONYM_PATTERN, (token, index: number) => {
    result += escapeHtml(value.slice(lastIndex, index));
    result += shouldProtectToken(token, hasLowercase, uppercaseWordCount)
      ? `<span translate="no" class="notranslate">${escapeHtml(token)}</span>`
      : escapeHtml(token);
    lastIndex = index + token.length;
    return token;
  });

  result += escapeHtml(value.slice(lastIndex));
  return result;
}

function shouldProtectToken(token: string, hasLowercase: boolean, uppercaseWordCount: number): boolean {
  const isDotted = token.includes('.');
  const hasSymbol = /[0-9/+.-]/.test(token);

  if (!isDotted && !hasSymbol && !hasLowercase && uppercaseWordCount > 2) {
    return false;
  }

  return true;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
