// Static hosts (e.g. GitHub Pages) serve 404.html for unknown paths; copy the
// app shell there so deep links like /tooth/36 work.
import { copyFileSync, existsSync } from 'node:fs';
if (existsSync('dist/index.html')) copyFileSync('dist/index.html', 'dist/404.html');
