import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { glob } from 'glob';
import postcss from 'postcss';

// CSS files to concatenate for minimal build (theme + component animations).
// Component stylesheets are discovered automatically so new components can't be
// forgotten. Theme tokens must come first so components can reference them.
const componentCssFiles = (await glob('./src/components/*.css')).sort();
const cssFiles = ['./src/styles/theme.css', ...componentCssFiles];

async function buildMinimalCSS() {
  const contents = await Promise.all(
    cssFiles.map(async file => {
      const content = await fs.readFile(file, 'utf-8');
      return `/* ${file} */\n${content}`;
    })
  );

  const output = contents.join('\n\n');
  await fs.writeFile('./styles.css', output, 'utf-8');
  console.log('CSS build complete: styles.css (minimal - for Tailwind users)');
}

// The Tailwind CLI output can contain exact duplicate declarations (same
// property, same value) inside a single rule, e.g. -webkit-text-decoration
// emitted by both Tailwind and the minifier's prefixing. An exact duplicate
// never changes the rendered result, so drop the extra copies to keep the
// generated file lint-clean.
async function dedupeDeclarations(file) {
  const css = await fs.readFile(file, 'utf-8');
  const root = postcss.parse(css);
  root.walkRules(rule => {
    const seen = new Set();
    rule.each(node => {
      if (node.type !== 'decl') return;
      const key = `${node.prop}|${node.value}|${node.important ? '!' : ''}`;
      if (seen.has(key)) {
        node.remove();
      } else {
        seen.add(key);
      }
    });
  });
  await fs.writeFile(file, root.toString(), 'utf-8');
}

async function buildFullCSS() {
  // Run Tailwind CLI to generate full CSS with all utilities
  execSync('npx @tailwindcss/cli -i ./src/styles/tailwind.css -o ./styles.full.css --minify', {
    stdio: 'inherit',
  });
  await dedupeDeclarations('./styles.full.css');
  console.log('CSS build complete: styles.full.css (full - for non-Tailwind users)');
}

async function buildCSS() {
  await Promise.all([buildMinimalCSS(), buildFullCSS()]);
}

async function watchCSS() {
  const { watch } = await import('node:fs');

  let timer = null;
  const rebuild = () => {
    // Debounce rapid successive change events
    clearTimeout(timer);
    timer = setTimeout(() => {
      buildCSS().catch(err => console.error('CSS rebuild failed:', err));
    }, 100);
  };

  for (const dir of ['./src/components', './src/styles']) {
    watch(dir, { recursive: true }, (event, filename) => {
      if (filename?.endsWith('.css')) {
        console.log(`CSS change detected: ${filename}`);
        rebuild();
      }
    });
  }

  console.log('Watching for CSS changes...');
}

buildCSS()
  .then(() => {
    if (process.argv.includes('--watch')) {
      return watchCSS();
    }
  })
  .catch(err => {
    console.error('CSS build failed:', err);
    process.exit(1);
  });
