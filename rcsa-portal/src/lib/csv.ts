// Tiny shared CSV exporter for the migrated standalone modules (RFC-4180 quoting,
// UTF-8 BOM so Excel opens it cleanly). New shared util — not used by the
// protected modules, which keep their own exporters.
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
