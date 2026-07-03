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

ChartJS.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
ChartJS.defaults.color = 'rgba(255, 255, 255, 0.55)';
ChartJS.defaults.borderColor = 'rgba(255, 255, 255, 0.10)';
