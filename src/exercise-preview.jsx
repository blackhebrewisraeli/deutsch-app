import React from 'react';
import ReactDOM from 'react-dom/client';
import { bootTheme } from './lib/themeMode.js';
import ExercisePreview from './components/exercises/ExercisePreview.jsx';

// Standalone sandbox. Not imported by main.jsx / App.jsx — opening
// /exercise-preview.html is the only way to mount it.
bootTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ExercisePreview />
  </React.StrictMode>
);
