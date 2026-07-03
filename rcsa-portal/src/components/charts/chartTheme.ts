import type { Theme } from '../../state/ThemeProvider';

// Chart.js colours per theme (Chart.js needs literal colours, not CSS vars).
export interface ChartPalette {
  text: string;
  axis: string;
  grid: string;
  bar: [string, string, string]; // low, medium, high
  donut: [string, string, string, string]; // open, in-progress, completed, overdue
  dept: string[]; // cycled for department bars
  threats: string;
  overdue: string;
  accepted: [string, string, string, string];
  gaps: [string, string, string]; // 0, 1-2, 3+
  heat: (score: number) => string;
}

const light: ChartPalette = {
  text: '#485957',
  axis: '#7d8e8c',
  grid: '#e2e9e8',
  bar: ['#16a34a', '#ca8a04', '#dc2626'],
  donut: ['#0284c7', '#0d9488', '#16a34a', '#dc2626'],
  dept: ['#0d9488', '#0284c7', '#7c3aed', '#ca8a04'],
  threats: '#0d9488',
  overdue: '#dc2626',
  accepted: ['#ca8a04', '#dc2626', '#7c3aed', '#0284c7'],
  gaps: ['#dc2626', '#ca8a04', '#16a34a'],
  heat: (s) => (s <= 4 ? '#16a34a' : s <= 9 ? '#ca8a04' : s <= 14 ? '#ea580c' : '#dc2626'),
};

const dark: ChartPalette = {
  text: '#9fb3b0',
  axis: '#6c7e7c',
  grid: '#1e2d2b',
  bar: ['#4ade80', '#fbbf24', '#f87171'],
  donut: ['#38bdf8', '#2dd4bf', '#4ade80', '#f87171'],
  dept: ['#2dd4bf', '#38bdf8', '#a78bfa', '#fbbf24'],
  threats: '#2dd4bf',
  overdue: '#f87171',
  accepted: ['#fbbf24', '#f87171', '#a78bfa', '#38bdf8'],
  gaps: ['#f87171', '#fbbf24', '#4ade80'],
  heat: (s) => (s <= 4 ? '#4ade80' : s <= 9 ? '#fbbf24' : s <= 14 ? '#fb923c' : '#f87171'),
};

export function chartPalette(theme: Theme): ChartPalette {
  return theme === 'dark' ? dark : light;
}
