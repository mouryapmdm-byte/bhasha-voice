import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Columns, 
  Rows, 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Check, 
  Search, 
  Download, 
  Upload, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronsLeft, 
  ChevronsRight, 
  FileText, 
  Eraser, 
  Layers, 
  X, 
  RefreshCw,
  FileDown,
  Calculator,
  Replace,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table,
  ClipboardPaste,
  SlidersHorizontal,
  BarChart3,
  Sigma,
  Wand2,
  PieChart,
  ArrowDownToLine
} from 'lucide-react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { cn, copyToClipboard } from '../lib/utils';

/**
 * Robust numeric parser for business, logistics, and railway freight tables.
 * Treats empty string as null, but treats common "zero" indications like 'Nil', 'nil', '-', 'N/A' as 0.
 * Strips currency marks, commas, and formatting spaces.
 */
export function parseNumericCell(val: string): number | null {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  // Common business representations of zero or no cargo / inward:
  // Nil, nil, NIL, None, none, NA, N/A, n/a, -, --
  if (/^(nil|none|na|n\/a|-|--|\.)$/i.test(trimmed)) {
    return 0;
  }
  const clean = trimmed.replace(/[\$,€,₹,£,%\s]/g, '').replace(/,/g, '');
  const num = Number(clean);
  return isNaN(num) ? null : num;
}

interface TabularGridProps {
  text: string;
  setText: (newText: string) => void;
  theme?: 'light' | 'dark';
}

interface TableSegment {
  id: number;
  startLine: number;
  endLine: number;
  headers: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right')[];
}

// Starter Table Templates
const TABLE_TEMPLATES = [
  {
    name: 'Railway Inward Rakes (DQG Station)',
    description: 'Commodity-wise inward freight rake positions with rake count, wagon count, tonnage, and freight earnings (Apr 2026 - Mar 2027)',
    headers: ['Month', 'Commodity', 'Rake', 'No. Of Wagon', 'Wt in Ton', 'Amount'],
    alignments: ['left', 'left', 'right', 'right', 'right', 'right'] as ('left' | 'center' | 'right')[],
    rows: [
      ['April', 'Cement', '1', '31', '6005.2', '7313829'],
      ['April', 'Onion', 'Nil', 'Nil', 'Nil', 'Nil'],
      ['May', 'Cement', '2.5', '106', '6830.2', '6782038'],
      ['May', 'Onion', 'Nil', 'Nil', 'Nil', 'Nil'],
      ['June', 'Cement', '2', '74', '18864', '19779813'],
      ['June', 'Onion', 'Nil', 'Nil', 'Nil', 'Nil'],
      ['July', 'Cement', '2.5', '89', '20314.8', '19779813'],
      ['July', 'Onion', '0.5', '5', '320', '630580'],
      ['August', 'Cement', '0.5', '24', '1536', '1350336'],
      ['August', 'Onion', 'Nil', 'Nil', 'Nil', 'Nil'],
      ['September', 'Cement', '2', '78', '497372', '4264327'],
      ['September', 'Onion', 'Nil', 'Nil', 'Nil', 'Nil'],
      ['Total', 'All Commodities', '11', '407', '551242.2', '59900736'],
    ]
  },
  {
    name: 'Financial Ledger',
    description: 'Track income, expenditures, categories, and account balance',
    headers: ['Date', 'Description', 'Category', 'Inflow ($)', 'Outflow ($)', 'Balance ($)'],
    alignments: ['left', 'left', 'left', 'right', 'right', 'right'] as ('left' | 'center' | 'right')[],
    rows: [
      ['2025-01-05', 'Client Retainer Payment', 'Revenue', '4500.00', '0.00', '14500.00'],
      ['2025-01-08', 'Cloud Infrastructure Hosting', 'DevOps', '0.00', '280.00', '14220.00'],
      ['2025-01-12', 'Software Licenses & Tools', 'Operations', '0.00', '150.00', '14070.00'],
      ['2025-01-15', 'Product Milestone Bonus', 'Revenue', '3200.00', '0.00', '17270.00'],
      ['2025-01-20', 'Marketing & Paid Ads', 'Growth', '0.00', '650.00', '16620.00'],
    ]
  },
  {
    name: 'Task & Sprint Tracker',
    description: 'Organize agile deliverables, owners, priority, and progress',
    headers: ['Task ID', 'Task Title', 'Assignee', 'Priority', 'Status', 'Due Date'],
    alignments: ['left', 'left', 'left', 'center', 'center', 'center'] as ('left' | 'center' | 'right')[],
    rows: [
      ['TASK-101', 'Optimize database connection pool', 'Aarav Patel', 'High', 'In Progress', '2025-02-10'],
      ['TASK-102', 'Redesign navigation drawer', 'Diya Sharma', 'Medium', 'Review', '2025-02-12'],
      ['TASK-103', 'Implement OAuth refresh token rotation', 'Rohan Verma', 'Urgent', 'Backlog', '2025-02-15'],
      ['TASK-104', 'Automate weekly analytics email digests', 'Priya Sen', 'Low', 'Completed', '2025-02-08'],
      ['TASK-105', 'Add unit tests for calculation engine', 'Aarav Patel', 'High', 'Pending', '2025-02-18'],
    ]
  },
  {
    name: 'Product Inventory',
    description: 'Manage warehouse SKU stock levels, unit costs, and valuations',
    headers: ['SKU', 'Item Name', 'Category', 'Stock Qty', 'Unit Price ($)', 'Total Value ($)'],
    alignments: ['left', 'left', 'left', 'right', 'right', 'right'] as ('left' | 'center' | 'right')[],
    rows: [
      ['SKU-A100', 'Wireless Ergonomic Keyboard', 'Hardware', '85', '79.99', '6799.15'],
      ['SKU-A102', 'Precision Optical Mouse', 'Hardware', '140', '39.50', '5530.00'],
      ['SKU-B201', 'USB-C Multiport Docking Station', 'Accessories', '45', '129.00', '5805.00'],
      ['SKU-B205', 'High-Speed Braided Cable (2m)', 'Cables', '320', '14.99', '4796.80'],
      ['SKU-C301', 'Noise-Cancelling Studio Headset', 'Audio', '60', '199.00', '11940.00'],
    ]
  },
  {
    name: 'Feature Comparison',
    description: 'Compare service tier offerings, limits, and pricing',
    headers: ['Feature / Capability', 'Starter Plan', 'Professional', 'Enterprise', 'Notes'],
    alignments: ['left', 'center', 'center', 'center', 'left'] as ('left' | 'center' | 'right')[],
    rows: [
      ['Monthly API Requests', '10,000', '250,000', 'Unlimited', 'Fair usage applies'],
      ['Concurrent Team Members', '1 User', '10 Users', 'Unlimited seats', 'SAML SSO included'],
      ['Data Retention Window', '30 Days', '1 Year', '7 Years / Custom', 'Automated backups'],
      ['Dedicated Support Tier', 'Community', 'Email (24h SLA)', 'Dedicated Slack & Phone', '24/7 coverage'],
      ['Export Formats', 'CSV only', 'CSV & Excel', 'CSV, Excel, API & SQL', 'Automated webhooks'],
    ]
  },
  {
    name: 'Employee Directory',
    description: 'Corporate team member roster, roles, and contacts',
    headers: ['Emp ID', 'Full Name', 'Department', 'Role Title', 'Email Address', 'Location'],
    alignments: ['left', 'left', 'left', 'left', 'left', 'left'] as ('left' | 'center' | 'right')[],
    rows: [
      ['EMP-01', 'Aditi Rao', 'Engineering', 'Staff Architect', 'aditi.rao@company.com', 'Bengaluru'],
      ['EMP-02', 'Marcus Vance', 'Product Design', 'Lead UX Designer', 'marcus.v@company.com', 'London'],
      ['EMP-03', 'Elena Rostova', 'Customer Success', 'Director of Support', 'elena.r@company.com', 'Berlin'],
      ['EMP-04', 'Kenji Tanaka', 'Infrastructure', 'Senior SRE', 'kenji.t@company.com', 'Tokyo'],
    ]
  }
];

// Split pipes respecting escaped \|
function splitPipes(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let escaped = false;

  const trimmed = line.trim();
  const content = (trimmed.startsWith('|') && trimmed.endsWith('|'))
    ? trimmed.slice(1, -1)
    : trimmed;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '\\') {
      escaped = !escaped;
      current += char;
    } else if (char === '|' && !escaped) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
      escaped = false;
    }
  }
  parts.push(current.trim());
  return parts;
}

const escapePipe = (val: string) => (val || '').replace(/(?<!\\)\|/g, '\\|');
const unescapePipe = (val: string) => (val || '').replace(/\\\|/g, '|');

// Pad cell text according to column alignment
function alignCellText(content: string, width: number, align: 'left' | 'center' | 'right'): string {
  const clean = content || '';
  const diff = Math.max(0, width - clean.length);
  if (align === 'right') {
    return ' '.repeat(diff) + clean;
  }
  if (align === 'center') {
    const leftPad = Math.floor(diff / 2);
    const rightPad = diff - leftPad;
    return ' '.repeat(leftPad) + clean + ' '.repeat(rightPad);
  }
  return clean + ' '.repeat(diff);
}

/**
 * Formats Markdown table where all column pipe lines '|' are intact and collinear.
 */
export function formatAlignedMarkdownTable(
  headers: string[], 
  rows: string[][], 
  alignments?: ('left' | 'center' | 'right')[]
): string {
  const aligns = alignments || headers.map(() => 'left');
  const escapedHeaders = headers.map(escapePipe);
  const escapedRows = rows.map(r => r.map(escapePipe));

  // Determine width of every column so all vertical lines '|' are intact and straight
  const colWidths = escapedHeaders.map((h, cIdx) => {
    let maxLen = Math.max((h || '').length, 3);
    escapedRows.forEach(row => {
      const cell = row[cIdx] || '';
      if (cell.length > maxLen) maxLen = cell.length;
    });
    return maxLen;
  });

  const headerLine = '| ' + escapedHeaders.map((h, i) => alignCellText(h || ' ', colWidths[i], aligns[i] || 'left')).join(' | ') + ' |';

  const separatorLine = '| ' + aligns.map((a, i) => {
    const width = colWidths[i];
    if (a === 'center') {
      return ':' + '-'.repeat(Math.max(1, width - 2)) + ':';
    }
    if (a === 'right') {
      return '-'.repeat(Math.max(2, width - 1)) + ':';
    }
    return ':' + '-'.repeat(Math.max(2, width - 1));
  }).join(' | ') + ' |';

  const rowLines = escapedRows.map(row => {
    return '| ' + row.map((cell, i) => {
      const align = aligns[i] || 'left';
      return alignCellText(cell || '', colWidths[i], align);
    }).join(' | ') + ' |';
  });

  return [headerLine, separatorLine, ...rowLines].join('\n');
}

/**
 * Formats a Unicode Box-Drawing table with intact contiguous borders.
 * Perfect for terminal output, emails, monospace displays, and reporting.
 */
export function formatBoxDrawingTable(
  headers: string[],
  rows: string[][],
  alignments?: ('left' | 'center' | 'right')[]
): string {
  const aligns = alignments || headers.map(() => 'left');
  const colWidths = headers.map((h, cIdx) => {
    let maxLen = Math.max((h || '').length, 3);
    rows.forEach(row => {
      const cell = row[cIdx] || '';
      if (cell.length > maxLen) maxLen = cell.length;
    });
    return maxLen;
  });

  const topBorder = '┌─' + colWidths.map(w => '─'.repeat(w)).join('─┬─') + '─┐';
  const midBorder = '├─' + colWidths.map(w => '─'.repeat(w)).join('─┼─') + '─┤';
  const bottomBorder = '└─' + colWidths.map(w => '─'.repeat(w)).join('─┴─') + '─┘';

  const headerLine = '│ ' + headers.map((h, i) => alignCellText(h, colWidths[i], aligns[i] || 'left')).join(' │ ') + ' │';
  const dataLines = rows.map(r => '│ ' + r.map((c, i) => alignCellText(c, colWidths[i], aligns[i] || 'left')).join(' │ ') + ' │');

  return [topBorder, headerLine, midBorder, ...dataLines, bottomBorder].join('\n');
}

// Robust RFC-4180 CSV / TSV Parser
function parseDelimitedText(raw: string): { headers: string[]; rows: string[][] } {
  const trimmed = raw.trim();
  if (!trimmed) return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };

  let delimiter = ',';
  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
  else if (firstLine.includes('|')) delimiter = '|';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    const nextChar = trimmed[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  const normalizedRows = dataRows.length > 0 
    ? dataRows.map(row => {
        const padded = [...row];
        while (padded.length < headers.length) padded.push('');
        return padded.slice(0, headers.length);
      })
    : [new Array(headers.length).fill('')];

  return { headers, rows: normalizedRows };
}

export function TabularGrid({ text, setText, theme = 'dark' }: TabularGridProps) {
  const [tables, setTables] = useState<TableSegment[]>([]);
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const [localHeaders, setLocalHeaders] = useState<string[]>([]);
  const [localRows, setLocalRows] = useState<string[][]>([]);
  const [alignments, setAlignments] = useState<('left' | 'center' | 'right')[]>([]);

  // Feedback Toasts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isBoxCopied, setIsBoxCopied] = useState(false);
  const [gridlineStyle, setGridlineStyle] = useState<'intact' | 'vivid' | 'subtle'>('intact');
  const [isLiveCsvPreview, setIsLiveCsvPreview] = useState(false);
  const [isCsvCopied, setIsCsvCopied] = useState(false);

  const rawCsvText = useMemo(() => {
    const escapeCsvCell = (val: string) => {
      const s = val || '';
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines: string[] = [];
    csvLines.push(localHeaders.map(escapeCsvCell).join(','));
    localRows.forEach(r => {
      csvLines.push(r.map(escapeCsvCell).join(','));
    });
    return csvLines.join('\n');
  }, [localHeaders, localRows]);

  const gridBorderClass = useMemo(() => {
    if (gridlineStyle === 'vivid') return 'border border-solid border-gray-400/90';
    if (gridlineStyle === 'subtle') return 'border border-solid border-gray-800/70';
    return 'border border-solid border-gray-600/90';
  }, [gridlineStyle]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState<number | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modals & Panels
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showCalculations, setShowCalculations] = useState(false);
  const [showPivotModal, setShowPivotModal] = useState(false);
  const [pivotGroupCol, setPivotGroupCol] = useState(1); // Default to column 1 (e.g. Commodity)
  const [showFillDownMenu, setShowFillDownMenu] = useState(false);
  const [fillDownTargetCol, setFillDownTargetCol] = useState(0); // Default to Column 0 (e.g. Month)
  const [showStructureMenu, setShowStructureMenu] = useState(false);

  // Find & Replace
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findCol, setFindCol] = useState<number | 'all'>('all');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);

  // Column Aggregations for Live Summary Calculations
  const [columnAggregations, setColumnAggregations] = useState<Record<number, 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none'>>({});

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: 'cell' | 'header' | 'row';
    rowIdx: number;
    colIdx: number;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isInternalSyncRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Robust parsing of all Markdown tables in text (including mismatched separator counts or colon-only lines)
  const parseAllTables = useCallback((rawDoc: string): { tables: TableSegment[]; prefix: string; suffix: string } => {
    if (!rawDoc) return { tables: [], prefix: '', suffix: '' };
    const lines = rawDoc.split(/\r?\n/);
    const detected: TableSegment[] = [];

    let i = 0;
    while (i < lines.length - 1) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim() || '';

      // Support standard separators (---|---), colon separators (:|:|:), or combinations (:-:|:---)
      const isSeparator = 
        nextLine.includes('|') &&
        (nextLine.includes('-') || nextLine.includes(':')) &&
        nextLine.replace(/[\s|:\-]/g, '') === '';

      if (line.includes('|') && isSeparator) {
        const startLine = i;
        const rawHeaders = splitPipes(line).map(unescapePipe);
        const parsedAlignments = splitPipes(nextLine).map(s => {
          const trimmed = s.trim();
          if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center' as const;
          if (trimmed.endsWith(':')) return 'right' as const;
          return 'left' as const;
        });

        let endLine = i + 1;
        const rawRows: string[][] = [];

        for (let j = i + 2; j < lines.length; j++) {
          const bodyLine = lines[j].trim();
          if (bodyLine.includes('|')) {
            rawRows.push(splitPipes(bodyLine).map(unescapePipe));
            endLine = j;
          } else {
            break;
          }
        }

        // Determine maximum column count across headers, separator, and all body rows
        let maxCols = rawHeaders.length;
        rawRows.forEach(row => {
          if (row.length > maxCols) maxCols = row.length;
        });
        if (parsedAlignments.length > maxCols) maxCols = Math.max(maxCols, parsedAlignments.length);

        // Pad headers if data rows or separator had more columns
        const headers = [...rawHeaders];
        while (headers.length < maxCols) {
          headers.push(`Column ${headers.length + 1}`);
        }

        // Pad alignments to maxCols
        while (parsedAlignments.length < maxCols) {
          parsedAlignments.push('left');
        }

        // Pad all rows to uniform maxCols
        const normalizedRows = rawRows.map(row => {
          const cells = [...row];
          while (cells.length < maxCols) cells.push('');
          return cells.slice(0, maxCols);
        });

        detected.push({
          id: detected.length,
          startLine,
          endLine,
          headers: headers.slice(0, maxCols),
          rows: normalizedRows.length > 0 ? normalizedRows : [new Array(maxCols).fill('')],
          alignments: parsedAlignments.slice(0, maxCols),
        });

        i = endLine + 1;
      } else {
        i++;
      }
    }

    let prefix = '';
    let suffix = '';
    if (detected.length > 0) {
      prefix = lines.slice(0, detected[0].startLine).join('\n');
      suffix = lines.slice(detected[detected.length - 1].endLine + 1).join('\n');
    }

    return { tables: detected, prefix, suffix };
  }, []);

  // Synchronize on external document change
  useEffect(() => {
    if (isInternalSyncRef.current) {
      isInternalSyncRef.current = false;
      return;
    }

    const { tables: parsedTables } = parseAllTables(text);
    setTables(parsedTables);

    if (parsedTables.length > 0) {
      const targetIdx = Math.min(activeTableIdx, parsedTables.length - 1);
      setActiveTableIdx(targetIdx);
      setLocalHeaders(parsedTables[targetIdx].headers);
      setLocalRows(parsedTables[targetIdx].rows);
      setAlignments(parsedTables[targetIdx].alignments);
      setErrorMsg(null);
    } else {
      setLocalHeaders([]);
      setLocalRows([]);
      setAlignments([]);
    }
  }, [text, parseAllTables]);

  // When activeTableIdx changes, reload local rows and alignments
  useEffect(() => {
    if (tables[activeTableIdx]) {
      setLocalHeaders(tables[activeTableIdx].headers);
      setLocalRows(tables[activeTableIdx].rows);
      setAlignments(tables[activeTableIdx].alignments || tables[activeTableIdx].headers.map(() => 'left'));
      setCurrentPage(1);
      setSearchQuery('');
    }
  }, [activeTableIdx, tables]);

  // High performance debounced sync to document
  const commitToDocument = useCallback((
    updatedHeaders: string[], 
    updatedRows: string[][], 
    updatedAlignments?: ('left' | 'center' | 'right')[]
  ) => {
    if (tables.length === 0) return;

    const currentTable = tables[activeTableIdx] || tables[0];
    const lines = text.split(/\r?\n/);

    const aligns = updatedAlignments || alignments || updatedHeaders.map(() => 'left');
    const tableMarkdown = formatAlignedMarkdownTable(updatedHeaders, updatedRows, aligns);

    const beforeLines = lines.slice(0, currentTable.startLine).join('\n');
    const afterLines = lines.slice(currentTable.endLine + 1).join('\n');

    const newFullText = [
      beforeLines.trim(),
      tableMarkdown,
      afterLines.trim()
    ].filter(Boolean).join('\n\n');

    isInternalSyncRef.current = true;
    setText(newFullText);
  }, [tables, activeTableIdx, text, setText, alignments]);

  const scheduleDebouncedSync = useCallback((
    headers: string[], 
    rows: string[][], 
    updatedAlignments?: ('left' | 'center' | 'right')[]
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      commitToDocument(headers, rows, updatedAlignments);
    }, 300);
  }, [commitToDocument]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Filter & Search rows
  const filteredRows = useMemo(() => {
    let result = localRows.map((row, originalIndex) => ({ row, originalIndex }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(({ row }) => {
        if (searchColumn === 'all') {
          return row.some(cell => (cell || '').toLowerCase().includes(q));
        } else {
          return (row[searchColumn] || '').toLowerCase().includes(q);
        }
      });
    }

    if (sortCol !== null && sortCol < localHeaders.length) {
      result.sort((a, b) => {
        const valA = (a.row[sortCol] || '').trim();
        const valB = (b.row[sortCol] || '').trim();

        // Strip currency symbols and commas for numeric sorting
        const cleanA = valA.replace(/[\$,€,₹,£,%]/g, '');
        const cleanB = valB.replace(/[\$,€,₹,£,%]/g, '');
        const numA = Number(cleanA);
        const numB = Number(cleanB);

        let cmp = 0;
        if (!isNaN(numA) && !isNaN(numB) && cleanA !== '' && cleanB !== '') {
          cmp = numA - numB;
        } else {
          cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        }

        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [localRows, searchQuery, searchColumn, sortCol, sortDir, localHeaders.length]);

  // Pagination calculation
  const totalRows = filteredRows.length;
  const effectivePageSize = pageSize === 'all' ? Math.max(totalRows, 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredRows;
    const start = (validCurrentPage - 1) * effectivePageSize;
    return filteredRows.slice(start, start + effectivePageSize);
  }, [filteredRows, validCurrentPage, effectivePageSize, pageSize]);

  // Cell change handler
  const handleCellChange = (originalRowIndex: number, colIndex: number, val: string) => {
    const updated = localRows.map((r, rIdx) => {
      if (rIdx === originalRowIndex) {
        const next = [...r];
        next[colIndex] = val;
        return next;
      }
      return r;
    });

    setLocalRows(updated);
    scheduleDebouncedSync(localHeaders, updated);
  };

  const handleCellBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    commitToDocument(localHeaders, localRows, alignments);
  };

  // Header change handler
  const handleHeaderChange = (colIndex: number, val: string) => {
    const next = [...localHeaders];
    next[colIndex] = val;
    setLocalHeaders(next);
    scheduleDebouncedSync(next, localRows);
  };

  // Alignment change handler
  const toggleColumnAlignment = (colIndex: number) => {
    const current = alignments[colIndex] || 'left';
    const nextAlignment = current === 'left' ? 'center' : current === 'center' ? 'right' : 'left';
    const nextAlignments = [...alignments];
    while (nextAlignments.length < localHeaders.length) nextAlignments.push('left');
    nextAlignments[colIndex] = nextAlignment;
    setAlignments(nextAlignments);
    commitToDocument(localHeaders, localRows, nextAlignments);
  };

  // Multi-cell Paste from Spreadsheet (Google Sheets or Excel)
  const handleCellPaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
    const clipboardText = e.clipboardData.getData('text');
    if (!clipboardText) return;

    if (clipboardText.includes('\t') || clipboardText.includes('\n')) {
      e.preventDefault();
      const lines = clipboardText
        .trim()
        .split(/\r?\n/)
        .map(l => l.split('\t').map(c => c.trim()));

      if (lines.length === 0) return;

      const nextRows = localRows.map(r => [...r]);
      const neededRows = startRow + lines.length;
      while (nextRows.length < neededRows) {
        nextRows.push(new Array(localHeaders.length).fill(''));
      }

      let maxCol = startCol;
      lines.forEach(l => {
        maxCol = Math.max(maxCol, startCol + l.length);
      });

      const nextHeaders = [...localHeaders];
      const nextAlignments = [...alignments];
      while (nextHeaders.length < maxCol) {
        nextHeaders.push(`Col ${nextHeaders.length + 1}`);
        nextAlignments.push('left');
        nextRows.forEach(r => {
          while (r.length < nextHeaders.length) r.push('');
        });
      }

      for (let r = 0; r < lines.length; r++) {
        for (let c = 0; c < lines[r].length; c++) {
          const targetR = startRow + r;
          const targetC = startCol + c;
          if (nextRows[targetR]) {
            nextRows[targetR][targetC] = lines[r][c];
          }
        }
      }

      setLocalHeaders(nextHeaders);
      setLocalRows(nextRows);
      setAlignments(nextAlignments);
      commitToDocument(nextHeaders, nextRows, nextAlignments);
      setSuccessMsg(`Pasted ${lines.length} rows × ${lines[0].length} columns from spreadsheet.`);
      setTimeout(() => setSuccessMsg(null), 2500);
    }
  };

  // Sort toggle
  const toggleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(colIndex);
      setSortDir('asc');
    }
  };

  // Add Rows
  const addRows = (count: number = 1, insertAfterIdx?: number) => {
    const newRowsToInsert = Array.from({ length: count }, () => 
      new Array(localHeaders.length).fill('')
    );

    let nextRows: string[][];
    if (insertAfterIdx !== undefined && insertAfterIdx >= 0) {
      nextRows = [
        ...localRows.slice(0, insertAfterIdx + 1),
        ...newRowsToInsert,
        ...localRows.slice(insertAfterIdx + 1)
      ];
    } else {
      nextRows = [...localRows, ...newRowsToInsert];
    }

    setLocalRows(nextRows);
    commitToDocument(localHeaders, nextRows);
    setSuccessMsg(`Added ${count} row${count > 1 ? 's' : ''}`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Delete Row
  const deleteRow = (originalIndex: number) => {
    if (localRows.length <= 1) {
      setErrorMsg("A table must contain at least one row.");
      return;
    }
    const nextRows = localRows.filter((_, idx) => idx !== originalIndex);
    setLocalRows(nextRows);
    commitToDocument(localHeaders, nextRows);
  };

  // Clean empty rows
  const cleanEmptyRows = () => {
    const nextRows = localRows.filter(r => r.some(c => c && c.trim().length > 0));
    if (nextRows.length === 0) {
      setErrorMsg("Cannot delete all rows as they are all empty.");
      return;
    }
    const removed = localRows.length - nextRows.length;
    setLocalRows(nextRows);
    commitToDocument(localHeaders, nextRows);
    setSuccessMsg(`Cleaned up ${removed} blank row${removed === 1 ? '' : 's'}.`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Auto-format table
  const autoFormatTable = () => {
    if (localHeaders.length === 0) return;
    const formattedHeaders = localHeaders.map(h => {
      const t = h.trim();
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Column';
    });
    const formattedRows = localRows.map(row => row.map(cell => cell.trim()));
    setLocalHeaders(formattedHeaders);
    setLocalRows(formattedRows);
    commitToDocument(formattedHeaders, formattedRows);
    setSuccessMsg("Table auto-formatted (spacing trimmed and headers normalized).");
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // 1. Fill Down (Forward Fill blank grouped cells like Month: April -> Onion)
  const fillDownColumn = (targetCol: number = 0) => {
    if (localRows.length === 0) return;
    let lastVal = '';
    let filledCount = 0;
    const nextRows = localRows.map((row) => {
      const cellVal = (row[targetCol] || '').trim();
      if (cellVal) {
        lastVal = row[targetCol];
        return row;
      } else if (lastVal) {
        filledCount++;
        const updated = [...row];
        updated[targetCol] = lastVal;
        return updated;
      }
      return row;
    });

    if (filledCount > 0) {
      setLocalRows(nextRows);
      commitToDocument(localHeaders, nextRows);
      setSuccessMsg(`Forward-filled ${filledCount} blank grouped cell${filledCount > 1 ? 's' : ''} in "${localHeaders[targetCol] || `Col ${targetCol + 1}`}".`);
    } else {
      setSuccessMsg(`No empty cells needed fill-down in "${localHeaders[targetCol] || `Col ${targetCol + 1}`}".`);
    }
    setShowFillDownMenu(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // 2. Clean HTML Line Breaks (<br>) from Column Headers
  const cleanHeaderLineBreaks = () => {
    const cleaned = localHeaders.map(h => 
      h.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim() || 'Column'
    );
    setLocalHeaders(cleaned);
    commitToDocument(cleaned, localRows);
    setSuccessMsg("Cleaned HTML line breaks (<br>) from column headers.");
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // 3. Remove Incomplete Placeholder Rows (e.g. October to March with no data entries)
  const removeIncompleteRows = () => {
    const nextRows = localRows.filter(r => {
      const isTotal = (r[0] || '').toLowerCase().trim().includes('total');
      if (isTotal) return true;
      // Keep if at least one data column has content
      return r.slice(1).some(c => (c || '').trim().length > 0);
    });
    const removed = localRows.length - nextRows.length;
    if (removed === 0) {
      setSuccessMsg("No incomplete placeholder rows found.");
      setTimeout(() => setSuccessMsg(null), 2000);
      return;
    }
    setLocalRows(nextRows);
    commitToDocument(localHeaders, nextRows);
    setSuccessMsg(`Removed ${removed} incomplete placeholder row${removed > 1 ? 's' : ''}.`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // 4. Auto-Compute & Populate "Total" Row (treating 'Nil' as 0)
  const autoComputeTotalsRow = () => {
    if (localRows.length === 0 || localHeaders.length === 0) return;

    let totalRowIdx = localRows.findIndex(r => {
      const firstCell = (r[0] || '').toLowerCase().trim();
      return firstCell === 'total' || firstCell === 'totals' || firstCell === 'summary' || firstCell === 'grand total';
    });

    const rowsToSum = localRows.filter((r, idx) => {
      if (idx === totalRowIdx) return false;
      return r.slice(1).some(c => (c || '').trim().length > 0);
    });

    if (rowsToSum.length === 0) {
      setErrorMsg("No data rows found to compute totals.");
      return;
    }

    const newTotalRow = new Array(localHeaders.length).fill('');
    newTotalRow[0] = 'Total';

    for (let col = 1; col < localHeaders.length; col++) {
      const vals = rowsToSum.map(r => r[col] || '');
      const numericVals = vals.map(parseNumericCell).filter((n): n is number => n !== null);

      if (numericVals.length > 0 && numericVals.length >= vals.filter(v => v.trim() !== '').length * 0.4) {
        const sum = numericVals.reduce((acc, curr) => acc + curr, 0);
        const hasDecimals = vals.some(v => v.includes('.') && !/^(nil|none|na|-)$/i.test(v.trim()));
        newTotalRow[col] = hasDecimals 
          ? sum.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).replace(/,/g, '')
          : String(Math.round(sum));
      } else {
        if (col === 1) {
          newTotalRow[col] = 'All Commodities';
        } else {
          newTotalRow[col] = '--';
        }
      }
    }

    let updatedRows: string[][];
    if (totalRowIdx >= 0) {
      updatedRows = localRows.map((r, idx) => idx === totalRowIdx ? newTotalRow : r);
    } else {
      updatedRows = [...localRows, newTotalRow];
    }

    setLocalRows(updatedRows);
    commitToDocument(localHeaders, updatedRows);
    setSuccessMsg("Calculated and populated Total row (accurately treating 'Nil' as 0).");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // 5. One-Click Table Syntax & Structure Auto-Repair
  const repairTableStructure = () => {
    // 1. Clean header <br>
    const cleanedHeaders = localHeaders.map(h => h.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim() || 'Column');
    // 2. Pad rows
    const cleanedRows = localRows.map(r => {
      const padded = [...r];
      while (padded.length < cleanedHeaders.length) padded.push('');
      return padded.slice(0, cleanedHeaders.length).map(c => c.trim());
    });
    // 3. Standard Alignments
    const cleanedAligns = [...alignments];
    while (cleanedAligns.length < cleanedHeaders.length) cleanedAligns.push('left');

    setLocalHeaders(cleanedHeaders);
    setLocalRows(cleanedRows);
    setAlignments(cleanedAligns.slice(0, cleanedHeaders.length));
    commitToDocument(cleanedHeaders, cleanedRows, cleanedAligns.slice(0, cleanedHeaders.length));
    setSuccessMsg("Table structure repaired: normalized column headers, balanced cell counts, and standard alignments.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Add Column
  const addColumn = () => {
    const newHeader = `Col ${localHeaders.length + 1}`;
    const nextHeaders = [...localHeaders, newHeader];
    const nextRows = localRows.map(r => [...r, '']);
    const nextAlignments = [...alignments, 'left' as const];
    setLocalHeaders(nextHeaders);
    setLocalRows(nextRows);
    setAlignments(nextAlignments);
    commitToDocument(nextHeaders, nextRows, nextAlignments);
  };

  // Delete Column
  const deleteColumn = (colIdx: number) => {
    if (localHeaders.length <= 1) {
      setErrorMsg("A table must contain at least one column.");
      return;
    }
    const nextHeaders = localHeaders.filter((_, idx) => idx !== colIdx);
    const nextRows = localRows.map(r => r.filter((_, idx) => idx !== colIdx));
    const nextAlignments = alignments.filter((_, idx) => idx !== colIdx);
    setLocalHeaders(nextHeaders);
    setLocalRows(nextRows);
    setAlignments(nextAlignments);
    commitToDocument(nextHeaders, nextRows, nextAlignments);
  };

  // Move Column
  const moveColumn = (colIdx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? colIdx - 1 : colIdx + 1;
    if (targetIdx < 0 || targetIdx >= localHeaders.length) return;

    const nextHeaders = [...localHeaders];
    const tempHeader = nextHeaders[colIdx];
    nextHeaders[colIdx] = nextHeaders[targetIdx];
    nextHeaders[targetIdx] = tempHeader;

    const nextAlignments = [...alignments];
    const tempAlign = nextAlignments[colIdx];
    nextAlignments[colIdx] = nextAlignments[targetIdx];
    nextAlignments[targetIdx] = tempAlign;

    const nextRows = localRows.map(r => {
      const copy = [...r];
      const temp = copy[colIdx];
      copy[colIdx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });

    setLocalHeaders(nextHeaders);
    setLocalRows(nextRows);
    setAlignments(nextAlignments);
    commitToDocument(nextHeaders, nextRows, nextAlignments);
  };

  // Move Row Up or Down
  const moveRow = (originalIndex: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? originalIndex - 1 : originalIndex + 1;
    if (targetIdx < 0 || targetIdx >= localRows.length) return;

    const nextRows = [...localRows];
    const temp = nextRows[originalIndex];
    nextRows[originalIndex] = nextRows[targetIdx];
    nextRows[targetIdx] = temp;

    setLocalRows(nextRows);
    commitToDocument(localHeaders, nextRows);
    setSuccessMsg(`Moved row ${direction === 'up' ? 'up' : 'down'}.`);
    setTimeout(() => setSuccessMsg(null), 1500);
  };

  // Insert Row Above or Below
  const insertRowAt = (originalIndex: number, position: 'above' | 'below') => {
    const insertIdx = position === 'above' ? originalIndex : originalIndex + 1;
    const newRow = new Array(localHeaders.length).fill('');
    const nextRows = [
      ...localRows.slice(0, insertIdx),
      newRow,
      ...localRows.slice(insertIdx)
    ];
    setLocalRows(nextRows);
    commitToDocument(localHeaders, nextRows);
    setSuccessMsg(`Inserted new row ${position === 'above' ? 'above' : 'below'} row ${originalIndex + 1}.`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Duplicate Row
  const duplicateRow = (originalIndex: number) => {
    const rowToDuplicate = localRows[originalIndex];
    if (!rowToDuplicate) return;
    const copiedRow = [...rowToDuplicate];
    const nextRows = [
      ...localRows.slice(0, originalIndex + 1),
      copiedRow,
      ...localRows.slice(originalIndex + 1)
    ];
    setLocalRows(nextRows);
    commitToDocument(localHeaders, nextRows);
    setSuccessMsg(`Duplicated row ${originalIndex + 1}.`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Insert Column Left or Right
  const insertColumnAt = (colIdx: number, position: 'left' | 'right') => {
    const insertIdx = position === 'left' ? colIdx : colIdx + 1;
    const newHeader = `Col ${localHeaders.length + 1}`;
    
    const nextHeaders = [
      ...localHeaders.slice(0, insertIdx),
      newHeader,
      ...localHeaders.slice(insertIdx)
    ];

    const nextAlignments = [
      ...alignments.slice(0, insertIdx),
      'left' as const,
      ...alignments.slice(insertIdx)
    ];

    const nextRows = localRows.map(r => [
      ...r.slice(0, insertIdx),
      '',
      ...r.slice(insertIdx)
    ]);

    setLocalHeaders(nextHeaders);
    setLocalRows(nextRows);
    setAlignments(nextAlignments);
    commitToDocument(nextHeaders, nextRows, nextAlignments);
    setSuccessMsg(`Inserted column ${position === 'left' ? 'left' : 'right'} of "${localHeaders[colIdx] || `Col ${colIdx + 1}`}".`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Duplicate Column
  const duplicateColumn = (colIdx: number) => {
    const colHeader = localHeaders[colIdx] || `Col ${colIdx + 1}`;
    const insertIdx = colIdx + 1;

    const nextHeaders = [
      ...localHeaders.slice(0, insertIdx),
      `${colHeader} (Copy)`,
      ...localHeaders.slice(insertIdx)
    ];

    const nextAlignments = [
      ...alignments.slice(0, insertIdx),
      alignments[colIdx] || 'left',
      ...alignments.slice(insertIdx)
    ];

    const nextRows = localRows.map(r => [
      ...r.slice(0, insertIdx),
      r[colIdx] || '',
      ...r.slice(insertIdx)
    ]);

    setLocalHeaders(nextHeaders);
    setLocalRows(nextRows);
    setAlignments(nextAlignments);
    commitToDocument(nextHeaders, nextRows, nextAlignments);
    setSuccessMsg(`Duplicated column "${colHeader}".`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Insert Table Template
  const applyTemplate = (template: typeof TABLE_TEMPLATES[0]) => {
    setLocalHeaders(template.headers);
    setLocalRows(template.rows);
    setAlignments(template.alignments);
    setCurrentPage(1);
    commitToDocument(template.headers, template.rows, template.alignments);
    setShowTemplatesModal(false);
    setSuccessMsg(`Loaded "${template.name}" template.`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  // Create new blank table
  const createNewTable = () => {
    applyTemplate(TABLE_TEMPLATES[0]);
  };

  // Find & Replace Handler
  const handleFindReplaceAll = () => {
    if (!findText) {
      setErrorMsg("Please enter text to find.");
      return;
    }

    let replaceCount = 0;
    const targetCol = findCol === 'all' ? -1 : findCol;

    const updatedRows = localRows.map(row => {
      return row.map((cell, colIdx) => {
        if (targetCol !== -1 && colIdx !== targetCol) return cell;

        if (findCaseSensitive) {
          if (cell.includes(findText)) {
            const occurrences = cell.split(findText).length - 1;
            replaceCount += occurrences;
            return cell.replaceAll(findText, replaceText);
          }
        } else {
          const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const matches = cell.match(regex);
          if (matches) {
            replaceCount += matches.length;
            return cell.replace(regex, replaceText);
          }
        }
        return cell;
      });
    });

    if (replaceCount > 0) {
      setLocalRows(updatedRows);
      commitToDocument(localHeaders, updatedRows);
      setSuccessMsg(`Replaced ${replaceCount} instance${replaceCount > 1 ? 's' : ''} across the table.`);
    } else {
      setErrorMsg(`No instances of "${findText}" found.`);
    }
  };

  // Live Count for Find
  const findMatchCount = useMemo(() => {
    if (!findText.trim()) return 0;
    let count = 0;
    const targetCol = findCol === 'all' ? -1 : findCol;

    localRows.forEach(row => {
      row.forEach((cell, colIdx) => {
        if (targetCol !== -1 && colIdx !== targetCol) return;
        if (findCaseSensitive) {
          if (cell.includes(findText)) {
            count += cell.split(findText).length - 1;
          }
        } else {
          const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const matches = cell.match(regex);
          if (matches) count += matches.length;
        }
      });
    });
    return count;
  }, [localRows, findText, findCol, findCaseSensitive]);

  // Import Handler (Excel or CSV or TSV)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

          const validRows = rawData.filter(r => Array.isArray(r) && r.some(c => String(c).trim() !== ''));
          if (validRows.length === 0) {
            setErrorMsg("No readable table data found in Excel sheet.");
            return;
          }

          const maxCols = Math.max(...validRows.map(r => r.length), 1);
          const rawHeader = validRows[0] || [];
          const impHeaders: string[] = [];
          for (let c = 0; c < maxCols; c++) {
            impHeaders.push(String(rawHeader[c] || `Column ${c + 1}`).trim());
          }

          const impRows: string[][] = [];
          for (let r = 1; r < validRows.length; r++) {
            const rowData = validRows[r] || [];
            const cells: string[] = [];
            for (let c = 0; c < maxCols; c++) {
              cells.push(String(rowData[c] ?? '').trim());
            }
            impRows.push(cells);
          }

          const defaultAlignments = impHeaders.map(() => 'left' as const);
          setLocalHeaders(impHeaders);
          setLocalRows(impRows.length > 0 ? impRows : [new Array(maxCols).fill('')]);
          setAlignments(defaultAlignments);
          setCurrentPage(1);
          commitToDocument(impHeaders, impRows.length > 0 ? impRows : [new Array(maxCols).fill('')], defaultAlignments);
          setSuccessMsg(`Successfully imported ${impRows.length} rows & ${impHeaders.length} columns from ${file.name}`);
          setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
          console.error("Excel import failed:", err);
          setErrorMsg("Failed to parse Excel file.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const { headers: impHeaders, rows: impRows } = parseDelimitedText(content);
          if (impHeaders.length === 0 || impRows.length === 0) {
            setErrorMsg("Failed to parse delimited data. Check file format.");
            return;
          }
          const defaultAlignments = impHeaders.map(() => 'left' as const);
          setLocalHeaders(impHeaders);
          setLocalRows(impRows);
          setAlignments(defaultAlignments);
          setCurrentPage(1);
          commitToDocument(impHeaders, impRows, defaultAlignments);
          setSuccessMsg(`Imported ${impRows.length} rows and ${impHeaders.length} columns from ${file.name}!`);
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      };
      reader.readAsText(file);
    }

    e.target.value = '';
  };

  // Export to Excel (.xlsx)
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const sheetData = [localHeaders, ...localRows];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths based on maximum content length
      const colWidths = localHeaders.map((h, i) => {
        let maxLen = (h || '').length;
        localRows.forEach(r => {
          if (r[i]) maxLen = Math.max(maxLen, String(r[i]).length);
        });
        return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
      });
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'DataSheet');
      const filename = `table_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      setSuccessMsg(`Exported table to ${filename}`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error("Excel export error:", err);
      setErrorMsg("Failed to export Excel file.");
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const escapeCsvCell = (val: string) => {
      const s = val || '';
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines: string[] = [];
    csvLines.push(localHeaders.map(escapeCsvCell).join(','));
    localRows.forEach(r => {
      csvLines.push(r.map(escapeCsvCell).join(','));
    });

    const blob = new Blob([csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `table_export_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Export to JSON
  const exportToJSON = () => {
    const jsonData = localRows.map(row => {
      const obj: Record<string, string> = {};
      localHeaders.forEach((h, i) => {
        obj[h || `col_${i + 1}`] = row[i] || '';
      });
      return obj;
    });

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    saveAs(blob, `table_export_${new Date().toISOString().slice(0, 10)}.json`);
  };

  // Copy as Markdown with intact aligned lines
  const copyTableAsMarkdown = async () => {
    const tableStr = formatAlignedMarkdownTable(localHeaders, localRows, alignments);
    const success = await copyToClipboard(tableStr);
    if (success) {
      setIsCopied(true);
      setSuccessMsg("Copied Markdown table with intact collinear pipes!");
      setTimeout(() => {
        setIsCopied(false);
        setSuccessMsg(null);
      }, 2000);
    }
  };

  // Copy as Box-Drawing Table (Unicode continuous borders)
  const copyTableAsBoxDrawing = async () => {
    const boxTable = formatBoxDrawingTable(localHeaders, localRows, alignments);
    const success = await copyToClipboard(boxTable);
    if (success) {
      setIsBoxCopied(true);
      setSuccessMsg("Copied Intact Box Table (solid Unicode gridlines)!");
      setTimeout(() => {
        setIsBoxCopied(false);
        setSuccessMsg(null);
      }, 2500);
    }
  };

  // Align all table columns and lines intact
  const alignAndRepairAllLines = () => {
    if (localHeaders.length === 0) return;

    let maxCols = localHeaders.length;
    localRows.forEach(r => {
      if (r.length > maxCols) maxCols = r.length;
    });

    const repairedHeaders = [...localHeaders];
    while (repairedHeaders.length < maxCols) {
      repairedHeaders.push(`Col ${repairedHeaders.length + 1}`);
    }

    const repairedAligns = [...alignments];
    while (repairedAligns.length < maxCols) {
      repairedAligns.push('left');
    }

    const repairedRows = localRows.map(r => {
      const copy = [...r];
      while (copy.length < maxCols) copy.push('');
      return copy.slice(0, maxCols);
    });

    setLocalHeaders(repairedHeaders);
    setAlignments(repairedAligns);
    setLocalRows(repairedRows);

    commitToDocument(repairedHeaders, repairedRows, repairedAligns);
    setSuccessMsg("All table lines aligned! Columns, pipes, and gridlines are 100% intact.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Copy as TSV (Spreadsheet format for 1-click paste into Google Sheets / Excel)
  const copyTableAsTSV = async () => {
    const tsvStr = [
      localHeaders.join('\t'),
      ...localRows.map(r => r.join('\t'))
    ].join('\n');

    const success = await copyToClipboard(tsvStr);
    if (success) {
      setSuccessMsg("Copied table as TSV (Ready to paste directly into Google Sheets or Excel)");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  // Column Calculation Aggregates
  const columnCalculations = useMemo(() => {
    const results: Record<number, { val: string; mode: string }> = {};

    localHeaders.forEach((_, colIdx) => {
      const mode = columnAggregations[colIdx] || 'none';
      if (mode === 'none') {
        results[colIdx] = { val: '--', mode: 'none' };
        return;
      }

      // Collect numeric values (from filteredRows if filtered, else all localRows)
      // Exclude existing Total/Summary row from calculations to avoid double-counting
      const targetRows = filteredRows
        .map(fr => fr.row)
        .filter(r => {
          const first = (r[0] || '').toLowerCase().trim();
          return !first.startsWith('total') && !first.startsWith('summary');
        });
      const rawValues = targetRows.map(r => r[colIdx] || '').filter(v => v.trim() !== '');

      if (mode === 'count') {
        results[colIdx] = { val: `${rawValues.length}`, mode: 'Count' };
        return;
      }

      const numbers = rawValues.map(parseNumericCell).filter((n): n is number => n !== null);

      if (numbers.length === 0) {
        results[colIdx] = { val: 'N/A', mode: mode.toUpperCase() };
        return;
      }

      if (mode === 'sum') {
        const total = numbers.reduce((acc, curr) => acc + curr, 0);
        results[colIdx] = { val: total.toLocaleString(undefined, { maximumFractionDigits: 2 }), mode: 'Sum' };
      } else if (mode === 'avg') {
        const avg = numbers.reduce((acc, curr) => acc + curr, 0) / numbers.length;
        results[colIdx] = { val: avg.toLocaleString(undefined, { maximumFractionDigits: 2 }), mode: 'Avg' };
      } else if (mode === 'min') {
        const min = Math.min(...numbers);
        results[colIdx] = { val: min.toLocaleString(undefined, { maximumFractionDigits: 2 }), mode: 'Min' };
      } else if (mode === 'max') {
        const max = Math.max(...numbers);
        results[colIdx] = { val: max.toLocaleString(undefined, { maximumFractionDigits: 2 }), mode: 'Max' };
      }
    });

    return results;
  }, [localHeaders, localRows, filteredRows, columnAggregations]);

  // Station & Commodity Pivot Data Memoization
  const pivotData = useMemo(() => {
    if (localHeaders.length < 2 || localRows.length === 0) return null;

    const groupCol = Math.min(Math.max(0, pivotGroupCol), localHeaders.length - 1);
    const groupColName = localHeaders[groupCol] || `Col ${groupCol + 1}`;

    // Filter out total rows and blank placeholder rows
    const dataRows = localRows.filter(r => {
      const first = (r[0] || '').toLowerCase().trim();
      if (first.startsWith('total') || first.startsWith('summary')) return false;
      return r.slice(1).some(c => (c || '').trim().length > 0);
    });

    // Detect numeric columns
    const numericCols = localHeaders.map((h, cIdx) => {
      if (cIdx === groupCol) return null;
      const vals = dataRows.map(r => r[cIdx] || '');
      const validNums = vals.map(parseNumericCell).filter((n): n is number => n !== null);
      if (validNums.length > 0 && validNums.length >= vals.filter(v => v.trim() !== '').length * 0.3) {
        return { colIdx: cIdx, header: h };
      }
      return null;
    }).filter((c): c is { colIdx: number; header: string } => c !== null);

    const groups: Record<string, {
      label: string;
      rowCount: number;
      sums: Record<number, number>;
    }> = {};

    dataRows.forEach(r => {
      const rawKey = (r[groupCol] || '').trim();
      const key = rawKey || '(Unspecified / Empty)';
      if (!groups[key]) {
        groups[key] = { label: key, rowCount: 0, sums: {} };
        numericCols.forEach(nc => {
          groups[key].sums[nc.colIdx] = 0;
        });
      }
      groups[key].rowCount++;
      numericCols.forEach(nc => {
        const val = parseNumericCell(r[nc.colIdx]) || 0;
        groups[key].sums[nc.colIdx] += val;
      });
    });

    const groupList = Object.values(groups);

    // Grand totals
    const grandTotals: Record<number, number> = {};
    numericCols.forEach(nc => {
      grandTotals[nc.colIdx] = groupList.reduce((acc, g) => acc + (g.sums[nc.colIdx] || 0), 0);
    });

    return {
      groupCol,
      groupColName,
      numericCols,
      groups: groupList,
      totalRecords: dataRows.length,
      grandTotals
    };
  }, [localHeaders, localRows, pivotGroupCol]);

  // Insert Pivot Summary Table into Document
  const insertPivotSummaryIntoDocument = () => {
    if (!pivotData || pivotData.groups.length === 0) return;

    const headers = [pivotData.groupColName, 'Shipments / Records', ...pivotData.numericCols.map(nc => nc.header)];
    const aligns = ['left', 'right', ...pivotData.numericCols.map(() => 'right')];

    const rows = pivotData.groups.map(g => [
      g.label,
      String(g.rowCount),
      ...pivotData.numericCols.map(nc => {
        const val = g.sums[nc.colIdx] || 0;
        return val % 1 === 0 ? String(val) : val.toFixed(1);
      })
    ]);

    // Add Grand Total row
    rows.push([
      'Grand Total',
      String(pivotData.totalRecords),
      ...pivotData.numericCols.map(nc => {
        const total = pivotData.grandTotals[nc.colIdx] || 0;
        return total % 1 === 0 ? String(total) : total.toFixed(1);
      })
    ]);

    const headerLine = '| ' + headers.map(escapePipe).join(' | ') + ' |';
    const separatorLine = '| ' + aligns.map(a => a === 'right' ? '---:' : '---').join(' | ') + ' |';
    const rowLines = rows.map(r => '| ' + r.map(escapePipe).join(' | ') + ' |');
    const pivotMarkdown = [
      `\n\n### 📊 ${pivotData.groupColName} Summary (Group Pivot Analysis)\n`,
      headerLine,
      separatorLine,
      ...rowLines
    ].join('\n');

    setText(text + pivotMarkdown);
    setShowPivotModal(false);
    setSuccessMsg(`Appended ${pivotData.groupColName} pivot summary table to document!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Export Pivot to Excel (.xlsx)
  const exportPivotToExcel = () => {
    if (!pivotData || pivotData.groups.length === 0) return;
    try {
      const wb = XLSX.utils.book_new();
      const headers = [pivotData.groupColName, 'Records', ...pivotData.numericCols.map(nc => nc.header)];
      const rows = pivotData.groups.map(g => [
        g.label,
        g.rowCount,
        ...pivotData.numericCols.map(nc => g.sums[nc.colIdx] || 0)
      ]);
      rows.push([
        'Grand Total',
        pivotData.totalRecords,
        ...pivotData.numericCols.map(nc => pivotData.grandTotals[nc.colIdx] || 0)
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, 'PivotSummary');
      const filename = `pivot_summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      setSuccessMsg(`Exported pivot summary to ${filename}`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error("Pivot export error:", err);
      setErrorMsg("Failed to export pivot to Excel.");
    }
  };

  // If no tables exist, show setup screen
  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-14 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.02] m-6 sm:m-10 shadow-2xl">
        <div className="p-5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-5">
          <FileSpreadsheet size={48} className="text-indigo-400 animate-pulse" />
        </div>
        <h3 className="text-base font-black uppercase tracking-widest text-white mb-2">Tabular Document Engine</h3>
        <p className="text-xs text-[#8E918F] max-w-lg leading-relaxed mb-6">
          No tabular document or Markdown table detected. Choose a starter business template, import an existing Excel workbook / CSV file, or build an interactive spreadsheet.
        </p>

        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/25 hover:scale-105 active:scale-95"
          >
            <Table size={14} />
            <span>Insert Business Template</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
          >
            <Upload size={14} className="text-emerald-400" />
            <span>Upload Excel (.xlsx) / CSV</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.04] hover:bg-white/10 text-[#C4C7C5] hover:text-white border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            <FileText size={14} className="text-indigo-400" />
            <span>Paste Delimited Data</span>
          </button>
        </div>

        {/* Template Quick Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl w-full text-left">
          {TABLE_TEMPLATES.slice(0, 3).map((tmpl, idx) => (
            <div 
              key={idx}
              onClick={() => applyTemplate(tmpl)}
              className="p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">{tmpl.name}</span>
                <span className="text-[10px] text-gray-500 font-mono">{tmpl.headers.length} cols</span>
              </div>
              <p className="text-[11px] text-[#8E918F] line-clamp-2 leading-relaxed">{tmpl.description}</p>
            </div>
          ))}
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".xlsx,.xls,.csv,.tsv,.txt" 
          className="hidden" 
          onChange={handleFileUpload} 
        />

        {/* Delimited Data Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#1E1F20] border border-[#333537] rounded-3xl p-6 w-full max-w-xl space-y-4 shadow-2xl text-left">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <Upload size={16} className="text-indigo-400" />
                  <span>Import Delimited Spreadsheet Data</span>
                </h4>
                <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-[#8E918F]">
                Paste your CSV, TSV (tab-separated), or pipe-separated raw data below to initialize the table.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="ID&#9;Name&#9;Category&#9;Price&#10;1&#9;Ergonomic Chair&#9;Furniture&#9;249.00&#10;2&#9;Standing Desk&#9;Furniture&#9;499.00"
                className="w-full h-44 bg-[#161718] border border-[#333537] rounded-xl p-3 text-xs text-white font-mono outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-white/5 text-gray-300 hover:bg-white/10 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const { headers: impHeaders, rows: impRows } = parseDelimitedText(importText);
                    if (impHeaders.length === 0 || impRows.length === 0) {
                      setErrorMsg("Failed to parse data.");
                      return;
                    }
                    const defaultAlignments = impHeaders.map(() => 'left' as const);
                    setLocalHeaders(impHeaders);
                    setLocalRows(impRows);
                    setAlignments(defaultAlignments);
                    setCurrentPage(1);
                    commitToDocument(impHeaders, impRows, defaultAlignments);
                    setShowImportModal(false);
                    setImportText('');
                    setSuccessMsg(`Imported ${impRows.length} rows & ${impHeaders.length} columns!`);
                  }}
                  disabled={!importText.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Parse & Load Table
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates Modal */}
        {showTemplatesModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#1E1F20] border border-[#333537] rounded-3xl p-6 w-full max-w-2xl space-y-4 shadow-2xl text-left">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <Table size={16} className="text-indigo-400" />
                  <span>Choose Tabular Template</span>
                </h4>
                <button onClick={() => setShowTemplatesModal(false)} className="text-gray-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {TABLE_TEMPLATES.map((tmpl, idx) => (
                  <div
                    key={idx}
                    onClick={() => applyTemplate(tmpl)}
                    className="p-4 bg-white/[0.03] hover:bg-indigo-600/15 border border-white/10 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">{tmpl.name}</span>
                      <span className="text-[10px] text-indigo-400 font-mono">{tmpl.headers.length} columns</span>
                    </div>
                    <p className="text-[11px] text-[#8E918F] mb-2">{tmpl.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {tmpl.headers.map((h, hIdx) => (
                        <span key={hIdx} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-300 font-mono">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="tabular-grid-editor" className="flex flex-col h-full w-full overflow-hidden p-2 sm:p-4 space-y-2.5">
      {/* Toast Messages */}
      {errorMsg && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-300 rounded-2xl p-2.5 text-xs font-semibold flex items-center justify-between shadow-lg">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-300 hover:text-white font-bold ml-2">×</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-2xl p-2.5 text-xs font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-300 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* Multi-Table Switcher (if more than 1 table detected) */}
      {tables.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/5">
          <span className="text-[10px] font-black uppercase text-[#8E918F] tracking-widest shrink-0 flex items-center gap-1">
            <Layers size={12} className="text-indigo-400" />
            <span>Tables:</span>
          </span>
          {tables.map((t, idx) => (
            <button
              key={t.id}
              onClick={() => setActiveTableIdx(idx)}
              className={cn(
                "px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5",
                activeTableIdx === idx
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-102"
                  : "bg-white/[0.04] text-[#C4C7C5] hover:bg-white/10 hover:text-white"
              )}
            >
              <span>Table {idx + 1}</span>
              <span className="text-[9px] opacity-70">({t.rows.length} rows)</span>
            </button>
          ))}
          <button
            onClick={createNewTable}
            className="px-2.5 py-1 bg-white/[0.03] hover:bg-white/10 text-indigo-400 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
            title="Add another table to document"
          >
            <Plus size={12} />
            <span>New Table</span>
          </button>
        </div>
      )}

      {/* Top Operations Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#1E1F20]/70 border border-[#333537] p-2.5 rounded-2xl backdrop-blur-md shadow-inner">
        {/* Left: Search & Filter */}
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={`Search ${localRows.length} rows...`}
              className="w-full pl-8 pr-7 py-1.5 bg-[#161718] border border-[#333537] focus:border-indigo-500/60 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {localHeaders.length > 1 && (
            <select
              value={searchColumn}
              onChange={(e) => {
                setSearchColumn(e.target.value === 'all' ? 'all' : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#161718] border border-[#333537] rounded-xl px-2.5 py-1.5 text-xs text-[#C4C7C5] outline-none"
            >
              <option value="all">All Columns</option>
              {localHeaders.map((h, i) => (
                <option key={i} value={i}>{h || `Col ${i + 1}`}</option>
              ))}
            </select>
          )}

          {sortCol !== null && (
            <button
              onClick={() => { setSortCol(null); setSortDir('asc'); }}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
              title="Reset Column Sort"
            >
              <RefreshCw size={10} />
              <span className="hidden sm:inline">Reset Sort</span>
            </button>
          )}
        </div>

        {/* Right: Actions, Add Row/Col, Features */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Add Rows */}
          <div className="flex items-center bg-white/[0.03] border border-[#333537] rounded-xl p-0.5">
            <button
              onClick={() => addRows(1)}
              className="px-2.5 py-1 text-xs font-bold text-indigo-400 hover:text-white hover:bg-indigo-600/30 rounded-lg transition-all flex items-center gap-1"
              title="Add 1 new row"
            >
              <Plus size={12} />
              <span>Row</span>
            </button>
            <button
              onClick={() => addRows(10)}
              className="px-2 py-1 text-[10px] font-bold text-indigo-400/80 hover:text-white hover:bg-indigo-600/30 rounded-lg transition-all"
              title="Add 10 rows"
            >
              +10
            </button>
          </div>

          {/* Add Column */}
          <button
            onClick={addColumn}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/10 text-indigo-300 border border-white/10 rounded-xl text-xs font-bold transition-all active:scale-95"
            title="Add column"
          >
            <Columns size={12} />
            <span>Col</span>
          </button>

          {/* Manage Structure Toggle Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStructureMenu(!showStructureMenu)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 shadow-sm",
                showStructureMenu
                  ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-indigo-500/10"
                  : "bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border-indigo-500/30"
              )}
              title="Open Structure Controls menu to insert, reorder, duplicate, or delete rows & columns"
            >
              <Rows size={12} className="text-indigo-400" />
              <span>Manage Structure</span>
              <ChevronDown size={11} className={showStructureMenu ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>

            {/* Structure Dropdown Panel */}
            {showStructureMenu && (
              <div className="absolute right-0 top-full mt-2 z-40 w-64 bg-[#1E1F20] border border-[#333537] rounded-2xl shadow-2xl p-3 text-xs text-slate-200 font-sans backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Rows size={13} className="text-indigo-400" />
                    <span>Grid Operations</span>
                  </span>
                  <button onClick={() => setShowStructureMenu(false)} className="text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar text-left">
                  {/* Row Operations */}
                  <div>
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Rows size={11} />
                      <span>Row Actions ({localRows.length})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => { addRows(1); setShowStructureMenu(false); }}
                        className="p-1.5 bg-white/[0.04] hover:bg-indigo-600/20 text-gray-200 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus size={11} className="text-indigo-400" />
                        <span>Add Row</span>
                      </button>
                      <button
                        onClick={() => { addRows(10); setShowStructureMenu(false); }}
                        className="p-1.5 bg-white/[0.04] hover:bg-indigo-600/20 text-gray-200 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus size={11} className="text-indigo-400" />
                        <span>+10 Rows</span>
                      </button>
                      <button
                        onClick={() => { insertRowAt(0, 'above'); setShowStructureMenu(false); }}
                        className="p-1.5 bg-white/[0.04] hover:bg-indigo-600/20 text-gray-200 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <ArrowUp size={11} className="text-indigo-400" />
                        <span>Row at Top</span>
                      </button>
                      <button
                        onClick={() => { duplicateRow(Math.max(0, localRows.length - 1)); setShowStructureMenu(false); }}
                        className="p-1.5 bg-white/[0.04] hover:bg-indigo-600/20 text-gray-200 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Copy size={11} className="text-amber-400" />
                        <span>Dup Last Row</span>
                      </button>
                    </div>
                  </div>

                  {/* Column Operations */}
                  <div className="border-t border-white/10 pt-2">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Columns size={11} />
                      <span>Column Actions ({localHeaders.length})</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => { addColumn(); setShowStructureMenu(false); }}
                        className="p-1.5 bg-white/[0.04] hover:bg-indigo-600/20 text-gray-200 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Plus size={11} className="text-indigo-400" />
                        <span>Add Column</span>
                      </button>
                      <button
                        onClick={() => { duplicateColumn(Math.max(0, localHeaders.length - 1)); setShowStructureMenu(false); }}
                        className="p-1.5 bg-white/[0.04] hover:bg-indigo-600/20 text-gray-200 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Copy size={11} className="text-amber-400" />
                        <span>Dup Last Col</span>
                      </button>
                      <button
                        onClick={() => { moveColumn(Math.max(0, localHeaders.length - 1), 'left'); setShowStructureMenu(false); }}
                        className="p-1.5 bg-white/[0.04] hover:bg-indigo-600/20 text-gray-200 border border-white/5 hover:border-indigo-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <ChevronLeft size={11} className="text-indigo-400" />
                        <span>Shift Col Left</span>
                      </button>
                      <button
                        onClick={() => { deleteColumn(Math.max(0, localHeaders.length - 1)); setShowStructureMenu(false); }}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Trash2 size={11} className="text-rose-400" />
                        <span>Delete Last Col</span>
                      </button>
                    </div>
                  </div>

                  {/* Clean up */}
                  <div className="border-t border-white/10 pt-2 flex items-center gap-2">
                    <button
                      onClick={() => { cleanEmptyRows(); setShowStructureMenu(false); }}
                      className="w-full py-1.5 px-2 bg-white/[0.04] hover:bg-white/10 text-gray-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1"
                    >
                      <Eraser size={11} className="text-gray-400" />
                      <span>Remove Empty Rows</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Find & Replace Toggle */}
          <button
            onClick={() => setShowFindReplace(!showFindReplace)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
              showFindReplace 
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                : "bg-white/[0.03] hover:bg-white/10 text-gray-300 border-white/10"
            )}
            title="Toggle Find & Replace in table"
          >
            <Replace size={12} className={showFindReplace ? "text-amber-400" : "text-gray-400"} />
            <span className="hidden md:inline">Find/Replace</span>
          </button>

          {/* Live Calculations / Totals Toggle */}
          <button
            onClick={() => {
              const nextState = !showCalculations;
              setShowCalculations(nextState);
              if (nextState) {
                // Pre-populate numeric columns with 'sum'
                const initialAggs: Record<number, 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none'> = {};
                localHeaders.forEach((_, cIdx) => {
                  const values = localRows.map(r => r[cIdx] || '').filter(v => v.trim() !== '');
                  const numericCount = values.filter(v => {
                    const clean = v.replace(/[\$,€,₹,£,%]/g, '').trim();
                    return !isNaN(Number(clean)) && clean !== '';
                  }).length;

                  if (numericCount > 0 && numericCount >= values.length * 0.6) {
                    initialAggs[cIdx] = 'sum';
                  } else {
                    initialAggs[cIdx] = 'count';
                  }
                });
                setColumnAggregations(initialAggs);
              }
            }}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
              showCalculations 
                ? "bg-indigo-600/25 text-indigo-300 border-indigo-500/40 shadow-sm" 
                : "bg-white/[0.03] hover:bg-white/10 text-gray-300 border-white/10"
            )}
            title="Toggle Live Summary Calculations Row (Sum, Average, Min, Max, Count)"
          >
            <Calculator size={12} className={showCalculations ? "text-indigo-400" : "text-gray-400"} />
            <span className="hidden md:inline">Calculations (Σ)</span>
          </button>

          {/* Auto-Compute Total Row */}
          <button
            onClick={autoComputeTotalsRow}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Auto-compute and populate 'Total' row across numeric columns (treating Nil as 0)"
          >
            <Sigma size={12} className="text-indigo-400" />
            <span>Auto Total</span>
          </button>

          {/* Fill Down (Unmerge Grouped Parent Keys) */}
          <button
            onClick={() => setShowFillDownMenu(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-600/20 hover:bg-sky-600/35 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Forward-fill blank grouped cells down from the value above (e.g. Month: April -> Onion)"
          >
            <ArrowDownToLine size={12} className="text-sky-400" />
            <span>Fill Down</span>
          </button>

          {/* Pivot & Group Analytics */}
          <button
            onClick={() => setShowPivotModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Analyze metrics and freight positions grouped by Commodity or Month"
          >
            <PieChart size={12} className="text-purple-400" />
            <span>Pivot & Insights</span>
          </button>

          {/* Templates Modal Button */}
          <button
            onClick={() => setShowTemplatesModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.03] hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            title="Insert standard table template (Includes DQG Railway Station dataset)"
          >
            <Table size={12} className="text-indigo-400" />
            <span className="hidden lg:inline">Templates</span>
          </button>

          {/* Clean <br> Line Breaks in Headers */}
          <button
            onClick={cleanHeaderLineBreaks}
            className="flex items-center gap-1 px-2 py-1.5 bg-white/[0.03] hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            title="Normalize HTML <br> tags in column headers"
          >
            <Wand2 size={12} className="text-amber-400" />
            <span className="hidden xl:inline">Clean &lt;br&gt;</span>
          </button>

          {/* Repair Table Structure */}
          <button
            onClick={repairTableStructure}
            className="flex items-center gap-1 px-2 py-1.5 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all"
            title="Repair syntax, balance column counts, and standardize markdown separators"
          >
            <Sparkles size={12} className="text-indigo-400" />
            <span className="hidden xl:inline">Repair</span>
          </button>

          {/* Remove Incomplete Rows */}
          <button
            onClick={removeIncompleteRows}
            className="flex items-center gap-1 px-2 py-1.5 bg-white/[0.03] hover:bg-white/10 text-rose-300/80 hover:text-rose-200 border border-white/10 rounded-xl text-xs font-bold transition-all"
            title="Remove incomplete placeholder rows (e.g. October to March with no data)"
          >
            <Eraser size={12} />
            <span className="hidden 2xl:inline">Trim Empty</span>
          </button>

          {/* Export Excel (.xlsx) */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Export full table to native Excel spreadsheet (.xlsx)"
          >
            <Download size={12} className="text-emerald-400" />
            <span>Excel (.xlsx)</span>
          </button>

          {/* Live CSV Preview Toggle Button */}
          <button
            onClick={() => setIsLiveCsvPreview(prev => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95 shadow-sm",
              isLiveCsvPreview
                ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10"
                : "bg-white/[0.04] hover:bg-white/10 text-emerald-400 border-white/10 hover:border-emerald-500/30"
            )}
            title="Toggle Live CSV Preview modal to view current grid data formatted as raw CSV text"
          >
            <FileSpreadsheet size={12} className={isLiveCsvPreview ? "text-emerald-300" : "text-emerald-400"} />
            <span>Live CSV Preview</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.03] hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            title="Export as CSV"
          >
            <FileDown size={12} />
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* Copy TSV for Google Sheets / Excel */}
          <button
            onClick={copyTableAsTSV}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.03] hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            title="Copy as TSV (Direct 1-click paste into Google Sheets / Excel)"
          >
            <ClipboardPaste size={12} className="text-amber-400" />
            <span className="hidden lg:inline">Copy for Sheets</span>
          </button>

          {/* Gridlines Contrast / Style Selector */}
          <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-1 text-xs gap-1.5" title="Gridline style to ensure lines remain 100% intact">
            <span className="text-[10px] text-gray-400 font-sans uppercase font-bold hidden xl:inline">Grid:</span>
            <select
              value={gridlineStyle}
              onChange={(e) => setGridlineStyle(e.target.value as any)}
              className="bg-transparent text-xs text-indigo-300 font-bold outline-none cursor-pointer"
            >
              <option value="intact" className="bg-[#1A1B1C] text-white">Solid (Intact)</option>
              <option value="vivid" className="bg-[#1A1B1C] text-white">High Contrast</option>
              <option value="subtle" className="bg-[#1A1B1C] text-white">Subtle</option>
            </select>
          </div>

          {/* Align All Lines Collinear */}
          <button
            onClick={alignAndRepairAllLines}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            title="Align all column pipes (|) collinear and keep gridlines completely intact"
          >
            <SlidersHorizontal size={12} className="text-indigo-400" />
            <span>Align Lines</span>
          </button>

          {/* Copy Box Table (Unicode Borders) */}
          <button
            onClick={copyTableAsBoxDrawing}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
              isBoxCopied
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-white/[0.03] hover:bg-white/10 text-gray-300 border-white/10"
            )}
            title="Copy table using continuous Unicode box drawing lines (┌─┬─┐ │ │ │ ├─┼─┤ └─┴─┘)"
          >
            {isBoxCopied ? <Check size={12} className="text-emerald-400" /> : <Table size={12} className="text-amber-400" />}
            <span className="hidden sm:inline">{isBoxCopied ? 'Copied' : 'Box Table'}</span>
          </button>

          {/* Copy Markdown */}
          <button
            onClick={copyTableAsMarkdown}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
              isCopied
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-white/[0.03] hover:bg-white/10 text-gray-300 border-white/10"
            )}
            title="Copy table as Markdown with aligned collinear pipes"
          >
            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-indigo-400" />}
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'MD'}</span>
          </button>

          {/* Import file (.xlsx, .xls, .csv, .tsv) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all active:scale-95"
            title="Import Excel or CSV file"
          >
            <Upload size={12} />
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {/* Find & Replace Bar (Collapsible) */}
      {showFindReplace && (
        <div className="bg-[#1A1B1C] border border-amber-500/30 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Find:</span>
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Text to find..."
                className="bg-[#141415] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400/60 w-36 sm:w-48"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Replace:</span>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with..."
                className="bg-[#141415] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-400/60 w-36 sm:w-48"
              />
            </div>

            <select
              value={findCol}
              onChange={(e) => setFindCol(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-[#141415] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-[#C4C7C5] outline-none"
            >
              <option value="all">Across All Columns</option>
              {localHeaders.map((h, i) => (
                <option key={i} value={i}>In {h || `Col ${i + 1}`}</option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={findCaseSensitive}
                onChange={(e) => setFindCaseSensitive(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span className="text-[11px]">Match Case</span>
            </label>

            {findText && (
              <span className="text-xs px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 font-mono">
                {findMatchCount} match{findMatchCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFindReplaceAll}
              disabled={!findText || findMatchCount === 0}
              className="px-3.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 disabled:opacity-30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Replace All
            </button>
            <button
              onClick={() => setShowFindReplace(false)}
              className="text-gray-400 hover:text-white p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".xlsx,.xls,.csv,.tsv,.txt" 
        className="hidden" 
        onChange={handleFileUpload} 
      />

      {/* Main High-Performance Table Container */}
      <div className="flex-1 min-h-[300px] border border-[#333537] rounded-2xl bg-[#161718]/90 overflow-hidden flex flex-col shadow-2xl">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className={cn("w-full border-collapse min-w-[700px] text-xs font-mono border", gridBorderClass)}>
            {/* Headers */}
            <thead className="sticky top-0 z-20 bg-[#1E1F20] shadow-md">
              <tr>
                {/* Row Index Column Header */}
                <th className={cn("p-2.5 w-12 text-center text-gray-400 border bg-[#1E1F20] font-sans text-[10px] uppercase font-bold", gridBorderClass)}>
                  #
                </th>

                {localHeaders.map((header, hIdx) => {
                  const isSorted = sortCol === hIdx;
                  const align = alignments[hIdx] || 'left';

                  return (
                    <th 
                      key={hIdx} 
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== 'INPUT' && !(e.target as HTMLElement).closest('button')) {
                          toggleSort(hIdx);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const w = 220, h = 340;
                        const x = Math.min(e.clientX, window.innerWidth - w - 12);
                        const y = Math.min(e.clientY, window.innerHeight - h - 12);
                        setContextMenu({ visible: true, x: Math.max(12, x), y: Math.max(12, y), type: 'header', rowIdx: -1, colIdx: hIdx });
                      }}
                      className={cn(
                        "p-1.5 border min-w-[150px] group bg-[#1E1F20] cursor-pointer hover:bg-white/[0.04] transition-colors select-none",
                        gridBorderClass,
                        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 px-1">
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => handleHeaderChange(hIdx, e.target.value)}
                          onBlur={handleCellBlur}
                          className={cn(
                            "bg-transparent text-xs font-bold border-none focus:outline-none focus:ring-1 focus:ring-indigo-500/40 rounded px-1.5 py-0.5 text-indigo-300 w-full cursor-text",
                            align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
                          )}
                          placeholder={`Column ${hIdx + 1}`}
                          onClick={(e) => e.stopPropagation()}
                        />

                        <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity gap-0.5">
                          {/* Alignment Toggle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleColumnAlignment(hIdx);
                            }}
                            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            title={`Toggle Alignment (${align.toUpperCase()})`}
                          >
                            {align === 'left' && <AlignLeft size={11} />}
                            {align === 'center' && <AlignCenter size={11} className="text-indigo-400" />}
                            {align === 'right' && <AlignRight size={11} className="text-amber-400" />}
                          </button>

                          {/* Sort Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSort(hIdx);
                            }}
                            className={cn(
                              "p-1 rounded hover:bg-white/10 transition-colors flex items-center gap-0.5 text-[10px]",
                              isSorted ? "text-indigo-400 font-bold bg-indigo-500/10" : "text-gray-500"
                            )}
                            title={`Sort (${sortDir === 'asc' ? 'Ascending' : 'Descending'})`}
                          >
                            <ArrowUpDown size={11} className={isSorted ? "text-indigo-400" : ""} />
                            {isSorted && (
                              <span className="text-[9px] font-black">{sortDir === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </button>

                          {/* Move Left */}
                          <button
                            onClick={() => moveColumn(hIdx, 'left')}
                            disabled={hIdx === 0}
                            className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 hidden group-hover:block"
                            title="Move column left"
                          >
                            <ChevronLeft size={11} />
                          </button>

                          {/* Move Right */}
                          <button
                            onClick={() => moveColumn(hIdx, 'right')}
                            disabled={hIdx === localHeaders.length - 1}
                            className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 hidden group-hover:block"
                            title="Move column right"
                          >
                            <ChevronRight size={11} />
                          </button>

                          {/* Delete Column */}
                          <button
                            onClick={() => deleteColumn(hIdx)}
                            className="p-1 text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/20 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Column"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}

                {/* Actions Header */}
                <th className={cn("p-2 w-28 text-center text-gray-400 border bg-[#1E1F20] font-sans text-[10px] uppercase font-bold", gridBorderClass)}>
                  Action
                </th>
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={localHeaders.length + 2} className="p-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search size={24} className="text-gray-600" />
                      <p className="text-xs">No matching records found for "{searchQuery}".</p>
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-indigo-400 hover:underline font-sans"
                      >
                        Clear search filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(({ row, originalIndex }, pIdx) => {
                  const displayIndex = originalIndex + 1;
                  const isTotalRow = (row[0] || '').toLowerCase().trim().includes('total');
                  return (
                    <tr 
                      key={originalIndex}
                      className={cn(
                        "transition-colors group",
                        isTotalRow 
                          ? "bg-indigo-950/40 font-bold hover:bg-indigo-950/60 text-indigo-200" 
                          : (pIdx % 2 === 0 ? "bg-white/[0.01]" : "bg-transparent"),
                        "hover:bg-white/[0.04]"
                      )}
                    >
                      {/* Row Index */}
                      <td 
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const w = 220, h = 340;
                          const x = Math.min(e.clientX, window.innerWidth - w - 12);
                          const y = Math.min(e.clientY, window.innerHeight - h - 12);
                          setContextMenu({ visible: true, x: Math.max(12, x), y: Math.max(12, y), type: 'row', rowIdx: originalIndex, colIdx: 0 });
                        }}
                        className={cn(
                          "p-2 text-center text-[10px] border select-none font-sans bg-[#18191a]/80 cursor-context-menu",
                          gridBorderClass,
                          isTotalRow ? "text-indigo-400 font-bold bg-indigo-950/40" : "text-gray-500"
                        )}
                        title="Right-click for row options"
                      >
                        {isTotalRow ? 'Σ' : displayIndex}
                      </td>

                      {/* Data Cells */}
                      {row.map((cell, cIdx) => {
                        const align = alignments[cIdx] || 'left';
                        return (
                          <td 
                            key={cIdx} 
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const w = 220, h = 340;
                              const x = Math.min(e.clientX, window.innerWidth - w - 12);
                              const y = Math.min(e.clientY, window.innerHeight - h - 12);
                              setContextMenu({ visible: true, x: Math.max(12, x), y: Math.max(12, y), type: 'cell', rowIdx: originalIndex, colIdx: cIdx });
                            }}
                            className={cn("p-0 border relative bg-[#141516]/40", gridBorderClass)}
                          >
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => handleCellChange(originalIndex, cIdx, e.target.value)}
                              onBlur={handleCellBlur}
                              onPaste={(e) => handleCellPaste(e, originalIndex, cIdx)}
                              className={cn(
                                "w-full h-full min-h-[34px] px-2.5 py-1.5 bg-transparent border-none outline-none focus:bg-indigo-500/10 focus:ring-1 focus:ring-inset focus:ring-indigo-400 rounded-none text-xs transition-colors",
                                isTotalRow ? "text-indigo-200 font-bold" : "text-slate-200",
                                align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
                              )}
                              placeholder="--"
                            />
                          </td>
                        );
                      })}

                      {/* Row Action Buttons */}
                      <td className={cn("p-1 text-center border bg-[#18191a]/80 min-w-[100px]", gridBorderClass)}>
                        <div className="flex items-center justify-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveRow(originalIndex, 'up')}
                            disabled={originalIndex === 0}
                            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-20"
                            title="Move row up"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            onClick={() => moveRow(originalIndex, 'down')}
                            disabled={originalIndex === localRows.length - 1}
                            className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors disabled:opacity-20"
                            title="Move row down"
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            onClick={() => duplicateRow(originalIndex)}
                            className="p-1 text-amber-400 hover:text-amber-200 hover:bg-amber-500/20 rounded transition-colors"
                            title="Duplicate this row"
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            onClick={() => insertRowAt(originalIndex, 'below')}
                            className="p-1 text-indigo-400 hover:text-white hover:bg-indigo-600/20 rounded transition-colors"
                            title="Insert new row below"
                          >
                            <Plus size={11} />
                          </button>
                          <button
                            onClick={() => deleteRow(originalIndex)}
                            className="p-1 text-rose-400/80 hover:text-rose-200 hover:bg-rose-500/20 rounded transition-colors"
                            title="Delete this row"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Live Summary Calculations Row */}
            {showCalculations && (
              <tfoot className="sticky bottom-0 z-10 bg-[#1A1B1C] shadow-xl">
                <tr>
                  <td className={cn("p-2 text-center text-[10px] font-black text-indigo-400 border uppercase select-none bg-[#1A1B1C]", gridBorderClass)}>
                    Σ
                  </td>
                  {localHeaders.map((_, cIdx) => {
                    const calc = columnCalculations[cIdx];
                    const currentMode = columnAggregations[cIdx] || 'none';
                    const align = alignments[cIdx] || 'left';

                    return (
                      <td 
                        key={cIdx} 
                        className={cn(
                          "p-1.5 border bg-[#1A1B1C]",
                          gridBorderClass,
                          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <select
                            value={currentMode}
                            onChange={(e) => {
                              const nextMode = e.target.value as any;
                              setColumnAggregations(prev => ({ ...prev, [cIdx]: nextMode }));
                            }}
                            className="bg-transparent text-[9px] text-gray-500 hover:text-gray-300 font-sans outline-none uppercase font-bold cursor-pointer"
                          >
                            <option value="none">--</option>
                            <option value="sum">Sum</option>
                            <option value="avg">Avg</option>
                            <option value="count">Count</option>
                            <option value="min">Min</option>
                            <option value="max">Max</option>
                          </select>
                          <span className={cn(
                            "text-xs font-bold font-mono px-1",
                            currentMode !== 'none' ? "text-indigo-300" : "text-gray-600"
                          )}>
                            {calc?.val}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td className={cn("p-1 text-center border text-[10px] text-gray-500 font-sans uppercase font-bold bg-[#1A1B1C]", gridBorderClass)}>
                    Totals
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Bottom Pagination & Status Bar */}
        <div className="border-t border-[#333537] bg-[#1E1F20] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#8E918F]">
          {/* Stats */}
          <div className="flex items-center gap-3 font-sans">
            <span className="font-bold text-white">
              {totalRows.toLocaleString()} rows
            </span>
            <span>•</span>
            <span>{localHeaders.length} columns</span>
            {searchQuery && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-semibold">
                  Filtered from {localRows.length.toLocaleString()} total
                </span>
              </>
            )}
            {sortCol !== null && (
              <>
                <span>•</span>
                <span className="text-indigo-400">
                  Sorted by {localHeaders[sortCol] || `Col ${sortCol + 1}`} ({sortDir.toUpperCase()})
                </span>
              </>
            )}
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-sans">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="bg-[#161718] border border-[#333537] rounded-lg px-2 py-0.5 text-white outline-none text-xs"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
                <option value={250}>250 / page</option>
                <option value="all">All rows</option>
              </select>
            </div>

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage <= 1}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-gray-400 hover:text-white"
                  title="First page"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={validCurrentPage <= 1}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-gray-400 hover:text-white"
                  title="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>

                <span className="font-mono text-xs text-white px-2">
                  Page {validCurrentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-gray-400 hover:text-white"
                  title="Next page"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-gray-400 hover:text-white"
                  title="Last page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status / Info */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 font-sans px-1">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-indigo-400" />
          <span>Continuous bidirectional sync to document active. Direct Excel (.xlsx) & Spreadsheet paste supported.</span>
        </div>
        <span>60fps virtual rendering engine</span>
      </div>

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1E1F20] border border-[#333537] rounded-3xl p-6 w-full max-w-2xl space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                <Table size={16} className="text-indigo-400" />
                <span>Choose Tabular Template</span>
              </h4>
              <button onClick={() => setShowTemplatesModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {TABLE_TEMPLATES.map((tmpl, idx) => (
                <div
                  key={idx}
                  onClick={() => applyTemplate(tmpl)}
                  className="p-4 bg-white/[0.03] hover:bg-indigo-600/15 border border-white/10 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{tmpl.name}</span>
                    <span className="text-[10px] text-indigo-400 font-mono">{tmpl.headers.length} columns</span>
                  </div>
                  <p className="text-[11px] text-[#8E918F] mb-2">{tmpl.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {tmpl.headers.map((h, hIdx) => (
                      <span key={hIdx} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-gray-300 font-mono">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fill Down (Forward Fill Blank Group Cells) Modal */}
      {showFillDownMenu && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1E1F20] border border-[#333537] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                <ArrowDownToLine size={16} className="text-sky-400" />
                <span>Fill Down / Unmerge Grouped Rows</span>
              </h4>
              <button onClick={() => setShowFillDownMenu(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-[#8E918F] leading-relaxed">
              Propagates parent category headers downwards to all blank child rows in the column (e.g. Month: copies <strong className="text-white">"April"</strong> down into the Onion row). This enables sorting, filtering, and database exports without losing parent group context.
            </p>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Select Group Column to Fill Down:</label>
              <select
                value={fillDownTargetCol}
                onChange={(e) => setFillDownTargetCol(Number(e.target.value))}
                className="w-full bg-[#161718] border border-[#333537] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-sky-500/60"
              >
                {localHeaders.map((h, i) => (
                  <option key={i} value={i}>Column {i + 1}: {h || `Col ${i + 1}`}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFillDownMenu(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => fillDownColumn(fillDownTargetCol)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-sky-600/30"
              >
                Apply Fill Down
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Station & Commodity Pivot Analytics Modal */}
      {showPivotModal && pivotData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1E1F20] border border-[#333537] rounded-3xl p-6 w-full max-w-4xl space-y-4 shadow-2xl text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/15 rounded-xl border border-purple-500/30">
                  <PieChart size={18} className="text-purple-400" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase text-white tracking-wider">
                    Tabular Pivot & Group Analytics
                  </h4>
                  <p className="text-[11px] text-[#8E918F]">
                    Aggregated rake positions, wagon counts, tonnage, and freight earnings (treating 'Nil' as 0)
                  </p>
                </div>
              </div>
              <button onClick={() => setShowPivotModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Pivot Controls */}
            <div className="flex items-center gap-3 bg-[#161718] p-3 rounded-2xl border border-white/5 shrink-0">
              <span className="text-xs font-bold text-gray-300 shrink-0">Group By Column:</span>
              <select
                value={pivotGroupCol}
                onChange={(e) => setPivotGroupCol(Number(e.target.value))}
                className="bg-[#1E1F20] border border-[#333537] rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-bold outline-none"
              >
                {localHeaders.map((h, i) => (
                  <option key={i} value={i}>{h || `Col ${i + 1}`}</option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500 font-mono ml-auto">
                {pivotData.totalRecords} records grouped into {pivotData.groups.length} categories
              </span>
            </div>

            {/* Pivot Table View */}
            <div className="overflow-x-auto overflow-y-auto flex-1 border border-[#333537] rounded-2xl bg-[#141415]">
              <table className="w-full border-collapse text-xs font-mono">
                <thead className="sticky top-0 bg-[#1E1F20] border-b border-[#333537] text-gray-400">
                  <tr>
                    <th className="p-2.5 text-left font-bold">{pivotData.groupColName}</th>
                    <th className="p-2.5 text-right font-bold">Records</th>
                    {pivotData.numericCols.map(nc => (
                      <th key={nc.colIdx} className="p-2.5 text-right font-bold">{nc.header}</th>
                    ))}
                    <th className="p-2.5 text-right font-bold">Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotData.groups.map((g, gIdx) => {
                    // Calculate share based on last numeric column (often Amount/Freight or Weight)
                    const lastNumCol = pivotData.numericCols[pivotData.numericCols.length - 1];
                    const lastGrandTotal = lastNumCol ? (pivotData.grandTotals[lastNumCol.colIdx] || 0) : 0;
                    const groupLastVal = lastNumCol ? (g.sums[lastNumCol.colIdx] || 0) : 0;
                    const sharePct = lastGrandTotal > 0 ? ((groupLastVal / lastGrandTotal) * 100).toFixed(1) : '--';

                    return (
                      <tr key={gIdx} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <td className="p-2.5 text-white font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                          <span>{g.label}</span>
                        </td>
                        <td className="p-2.5 text-right text-gray-400">{g.rowCount}</td>
                        {pivotData.numericCols.map(nc => {
                          const val = g.sums[nc.colIdx] || 0;
                          return (
                            <td key={nc.colIdx} className="p-2.5 text-right text-slate-200">
                              {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                          );
                        })}
                        <td className="p-2.5 text-right text-purple-300 font-bold">
                          {sharePct !== '--' ? `${sharePct}%` : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#1A1B1C] border-t-2 border-purple-500/50 font-bold text-white">
                  <tr>
                    <td className="p-2.5 uppercase tracking-wider text-purple-300">Grand Total</td>
                    <td className="p-2.5 text-right">{pivotData.totalRecords}</td>
                    {pivotData.numericCols.map(nc => {
                      const total = pivotData.grandTotals[nc.colIdx] || 0;
                      return (
                        <td key={nc.colIdx} className="p-2.5 text-right text-purple-200 font-mono">
                          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                    <td className="p-2.5 text-right text-purple-300">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pivot Modal Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 shrink-0">
              <span className="text-[11px] text-gray-500">
                Accurate totals accounting for all freight metrics with zero NaN disruptions.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportPivotToExcel}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Download size={13} className="text-emerald-400" />
                  <span>Export Pivot (.xlsx)</span>
                </button>
                <button
                  onClick={insertPivotSummaryIntoDocument}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Table size={13} />
                  <span>Insert Summary Table in Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live CSV Preview Readonly Modal */}
      {isLiveCsvPreview && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1E1F20] border border-[#333537] rounded-3xl p-6 w-full max-w-3xl flex flex-col max-h-[85vh] shadow-2xl space-y-4 text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black uppercase text-white tracking-wider">
                      Live CSV Preview
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      Read-Only
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8E918F]">
                    Current grid data formatted as raw comma-separated values (RFC-4180).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-gray-400 hidden sm:inline">
                  {localRows.length.toLocaleString()} rows • {localHeaders.length} cols
                </span>
                <button 
                  onClick={() => setIsLiveCsvPreview(false)} 
                  className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  title="Close Live CSV Preview"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Readonly Raw CSV Content Area */}
            <div className="flex-1 min-h-[260px] relative flex flex-col">
              <textarea
                readOnly
                value={rawCsvText}
                className="w-full flex-1 p-4 bg-[#121314] border border-[#333537] rounded-2xl font-mono text-xs text-emerald-300/90 leading-relaxed overflow-auto resize-none outline-none select-text cursor-text focus:border-emerald-500/50 shadow-inner"
                rows={16}
                spellCheck={false}
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 shrink-0">
              <div className="text-[11px] text-gray-500 flex items-center gap-2">
                <span>Payload:</span>
                <span className="font-mono text-gray-400">
                  {new Blob([rawCsvText]).size.toLocaleString()} bytes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const success = await copyToClipboard(rawCsvText);
                    if (success) {
                      setIsCsvCopied(true);
                      setSuccessMsg("Copied raw CSV text to clipboard!");
                      setTimeout(() => {
                        setIsCsvCopied(false);
                        setSuccessMsg(null);
                      }, 2000);
                    }
                  }}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border",
                    isCsvCopied
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-white/[0.04] hover:bg-white/10 text-white border-white/10"
                  )}
                  title="Copy raw CSV to clipboard"
                >
                  {isCsvCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-indigo-400" />}
                  <span>{isCsvCopied ? 'Copied' : 'Copy CSV'}</span>
                </button>

                <button
                  onClick={exportToCSV}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  title="Download as .csv file"
                >
                  <Download size={13} className="text-emerald-400" />
                  <span>Download .csv</span>
                </button>

                <button
                  onClick={() => setIsLiveCsvPreview(false)}
                  className="px-4 py-2 bg-[#282A2C] hover:bg-[#333537] text-white rounded-xl text-xs font-bold transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Right-Click Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-56 bg-[#1E1F20] border border-[#333537] rounded-2xl shadow-2xl p-1.5 text-xs text-slate-200 font-sans backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-white/10 text-[10px] font-black uppercase text-indigo-400 flex items-center justify-between select-none">
            <span>
              {contextMenu.type === 'header' && `Col: ${localHeaders[contextMenu.colIdx] || `Col ${contextMenu.colIdx + 1}`}`}
              {contextMenu.type === 'row' && `Row #${contextMenu.rowIdx + 1}`}
              {contextMenu.type === 'cell' && `Cell (${contextMenu.rowIdx + 1}, ${contextMenu.colIdx + 1})`}
            </span>
            <span className="text-[9px] text-gray-500 font-mono">Options</span>
          </div>

          <div className="py-1 space-y-0.5 max-h-[380px] overflow-y-auto custom-scrollbar text-left">
            {/* Row Actions */}
            <div className="px-2 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Row Operations</div>
            <button
              onClick={() => {
                insertRowAt(contextMenu.rowIdx >= 0 ? contextMenu.rowIdx : 0, 'above');
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
            >
              <Plus size={13} className="text-indigo-400" />
              <span>Insert Row Above</span>
            </button>
            <button
              onClick={() => {
                insertRowAt(contextMenu.rowIdx >= 0 ? contextMenu.rowIdx : localRows.length - 1, 'below');
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
            >
              <Plus size={13} className="text-indigo-400" />
              <span>Insert Row Below</span>
            </button>
            {contextMenu.rowIdx >= 0 && (
              <>
                <button
                  disabled={contextMenu.rowIdx === 0}
                  onClick={() => {
                    moveRow(contextMenu.rowIdx, 'up');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white disabled:opacity-30 rounded-lg transition-colors text-left"
                >
                  <ArrowUp size={13} className="text-indigo-400" />
                  <span>Move Row Up</span>
                </button>
                <button
                  disabled={contextMenu.rowIdx === localRows.length - 1}
                  onClick={() => {
                    moveRow(contextMenu.rowIdx, 'down');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white disabled:opacity-30 rounded-lg transition-colors text-left"
                >
                  <ArrowDown size={13} className="text-indigo-400" />
                  <span>Move Row Down</span>
                </button>
                <button
                  onClick={() => {
                    duplicateRow(contextMenu.rowIdx);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
                >
                  <Copy size={13} className="text-amber-400" />
                  <span>Duplicate Row</span>
                </button>
                <button
                  onClick={() => {
                    deleteRow(contextMenu.rowIdx);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-300 rounded-lg transition-colors text-left"
                >
                  <Trash2 size={13} className="text-rose-400" />
                  <span>Delete Row</span>
                </button>
              </>
            )}

            <div className="my-1 border-t border-white/10" />

            {/* Column Actions */}
            <div className="px-2 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Column Operations</div>
            {contextMenu.colIdx >= 0 && (
              <>
                <button
                  onClick={() => {
                    insertColumnAt(contextMenu.colIdx, 'left');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
                >
                  <Columns size={13} className="text-indigo-400" />
                  <span>Insert Column Left</span>
                </button>
                <button
                  onClick={() => {
                    insertColumnAt(contextMenu.colIdx, 'right');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
                >
                  <Columns size={13} className="text-indigo-400" />
                  <span>Insert Column Right</span>
                </button>
                <button
                  disabled={contextMenu.colIdx === 0}
                  onClick={() => {
                    moveColumn(contextMenu.colIdx, 'left');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white disabled:opacity-30 rounded-lg transition-colors text-left"
                >
                  <ChevronLeft size={13} className="text-indigo-400" />
                  <span>Move Column Left</span>
                </button>
                <button
                  disabled={contextMenu.colIdx === localHeaders.length - 1}
                  onClick={() => {
                    moveColumn(contextMenu.colIdx, 'right');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white disabled:opacity-30 rounded-lg transition-colors text-left"
                >
                  <ChevronRight size={13} className="text-indigo-400" />
                  <span>Move Column Right</span>
                </button>
                <button
                  onClick={() => {
                    duplicateColumn(contextMenu.colIdx);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
                >
                  <Copy size={13} className="text-amber-400" />
                  <span>Duplicate Column</span>
                </button>
                <button
                  onClick={() => {
                    toggleColumnAlignment(contextMenu.colIdx);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
                >
                  <AlignLeft size={13} className="text-indigo-400" />
                  <span>Toggle Column Align</span>
                </button>
                <button
                  onClick={() => {
                    deleteColumn(contextMenu.colIdx);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-300 rounded-lg transition-colors text-left"
                >
                  <Trash2 size={13} className="text-rose-400" />
                  <span>Delete Column</span>
                </button>
              </>
            )}

            {/* Cell Actions */}
            {contextMenu.type === 'cell' && (
              <>
                <div className="my-1 border-t border-white/10" />
                <div className="px-2 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Cell Actions</div>
                <button
                  onClick={async () => {
                    const cellVal = localRows[contextMenu.rowIdx]?.[contextMenu.colIdx] || '';
                    if (cellVal) {
                      await copyToClipboard(cellVal);
                      setSuccessMsg(`Copied "${cellVal.slice(0, 20)}" to clipboard.`);
                      setTimeout(() => setSuccessMsg(null), 2000);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left"
                >
                  <Copy size={13} className="text-indigo-400" />
                  <span>Copy Cell Value</span>
                </button>
                <button
                  onClick={() => {
                    handleCellChange(contextMenu.rowIdx, contextMenu.colIdx, '');
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-indigo-600/20 hover:text-white rounded-lg transition-colors text-left text-gray-300"
                >
                  <Eraser size={13} className="text-gray-400" />
                  <span>Clear Cell Content</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
