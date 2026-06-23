import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

// Register once for the whole app (tree-shakeable build).
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, Tooltip, Legend, Title);

ChartJS.defaults.font.family = 'sans-serif';
ChartJS.defaults.color = '#64748b';
