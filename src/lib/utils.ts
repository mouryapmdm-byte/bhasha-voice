import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if a string contains a Markdown table structure.
 * Robust enough to handle complex multi-row Markdown tables, variations in formatting, alignments, and missing edge pipes.
 */
export function containsTable(text: string): boolean {
  if (!text) return false;
  const lines = text.split('\n');
  let pipeRowCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.includes('|')) {
      pipeRowCount++;
      // Check if followed by GFM separator line
      if (i < lines.length - 1) {
        const nextLine = lines[i + 1]?.trim() || '';
        if (
          nextLine.includes('|') &&
          (nextLine.includes('-') || nextLine.includes(':')) &&
          (/^[\|\s:\-]+$/.test(nextLine) || /^\|?[\s|:\-]+\|?$/.test(nextLine))
        ) {
          return true;
        }
      }
    }
  }
  // If text contains 3 or more pipe-delimited lines, it's a multi-row table structure even without explicit GFM separator
  return pipeRowCount >= 3;
}

/**
 * Ultra-resilient, mobile-optimized clipboard copy utility.
 * Works seamlessly across mobile iOS (Safari/WebKit), Android (Chrome/Firefox/Samsung),
 * embedded WebViews, sandboxed iframes, and desktop browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern navigator.clipboard first if available and permission allows
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (clipErr) {
      // If blocked by iframe or browser permissions, fall through to mobile-optimized DOM fallback
      console.warn("navigator.clipboard.writeText blocked or failed, attempting mobile-optimized DOM fallback:", clipErr);
    }
  }

  // 2. Mobile-optimized DOM fallback using iOS/Android-compatible selection range
  try {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const textarea = document.createElement('textarea');
    textarea.value = text;
    
    // Prevent zoom, scroll jumping, and keyboard popup on mobile devices
    textarea.style.fontSize = '16px'; // Prevents iOS Safari auto-zoom
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = (typeof window !== 'undefined' ? window.scrollY || document.documentElement.scrollTop : 0) + 'px';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    
    if (isIOS) {
      textarea.contentEditable = 'true';
      textarea.readOnly = false;
    } else {
      textarea.setAttribute('readonly', '');
    }

    document.body.appendChild(textarea);

    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textarea.setSelectionRange(0, 999999);
    } else {
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
    }

    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (successful) {
      return true;
    }
  } catch (domErr) {
    console.warn("Mobile DOM execCommand copy fallback failed:", domErr);
  }

  return false;
}

/**
 * Strips raw markdown syntax, code fences, markdown links, section dividers, and bold/italic markup
 * to produce clean, natural prose without raw markdown delimiters, while preserving table rows intact.
 */
export function stripMarkdownAndDelimiters(str: string): string {
  if (!str) return '';
  const lines = str.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Preserve table rows and separator rows intact so TabularGrid functions perfectly
    const isTableRow = trimmed.startsWith('|') || (trimmed.includes('|') && /^[\|\s:\-]+$/.test(trimmed));
    if (isTableRow) {
      processedLines.push(line);
      continue;
    }

    // Clean non-table lines
    const cleaned = line
      .replace(/```[a-zA-Z]*\n?/gi, '')
      .replace(/```/g, '')
      .replace(/^[\s]*[-*_]{3,}[\s]*$/g, '')
      .replace(/^[\s]*={3,}[\s]*$/g, '')
      .replace(/[-=]{2,}\s*[^-\n]+\s*[-=]{2,}/gi, '')
      .replace(/^[\s]*#{1,6}\s+/g, '')
      .replace(/(\*\*|__|[*_])(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(?<!\!)\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[\s]*>\s?/g, '');

    processedLines.push(cleaned);
  }

  return processedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
