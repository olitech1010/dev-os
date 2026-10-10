#!/usr/bin/env node

/**
 * Dev-OS Awesome Design Catalog Synchronizer
 * 
 * Synchronizes curated DESIGN.md files from VoltAgent/awesome-design-md
 * into .agents/catalog/design-systems/ with an indexed JSON metadata registry.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO_URL = 'https://github.com/VoltAgent/awesome-design-md.git';
const ROOT_DIR = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(ROOT_DIR, '.agents', 'catalog', 'design-systems');
const SYSTEMS_DIR = path.join(CATALOG_DIR, 'systems');
const INDEX_FILE = path.join(CATALOG_DIR, 'index.json');

// Category mapping fallback based on awesome-design-md README structure
const CATEGORY_MAP = {
  // AI & LLM Platforms
  'claude': 'AI & LLM Platforms',
  'cohere': 'AI & LLM Platforms',
  'elevenlabs': 'AI & LLM Platforms',
  'minimax': 'AI & LLM Platforms',
  'mistral.ai': 'AI & LLM Platforms',
  'ollama': 'AI & LLM Platforms',
  'opencode.ai': 'AI & LLM Platforms',
  'replicate': 'AI & LLM Platforms',
  'runwayml': 'AI & LLM Platforms',
  'together.ai': 'AI & LLM Platforms',
  'voltagent': 'AI & LLM Platforms',
  'x.ai': 'AI & LLM Platforms',

  // Developer Tools & IDEs
  'clickhouse': 'Developer Tools & IDEs',
  'composio': 'Developer Tools & IDEs',
  'cursor': 'Developer Tools & IDEs',
  'docker': 'Developer Tools & IDEs',
  'expo': 'Developer Tools & IDEs',
  'github': 'Developer Tools & IDEs',
  'grafana': 'Developer Tools & IDEs',
  'hashicorp': 'Developer Tools & IDEs',
  'linear.app': 'Developer Tools & IDEs',
  'mintlify': 'Developer Tools & IDEs',
  'mongodb': 'Developer Tools & IDEs',
  'posthog': 'Developer Tools & IDEs',
  'postman': 'Developer Tools & IDEs',
  'raycast': 'Developer Tools & IDEs',
  'resend': 'Developer Tools & IDEs',
  'sanity': 'Developer Tools & IDEs',
  'sentry': 'Developer Tools & IDEs',
  'supabase': 'Developer Tools & IDEs',
  'vercel': 'Developer Tools & IDEs',
  'warp': 'Developer Tools & IDEs',

  // Design & Creative Tools
  'airtable': 'Design & Creative Tools',
  'clay': 'Design & Creative Tools',
  'figma': 'Design & Creative Tools',
  'framer': 'Design & Creative Tools',
  'miro': 'Design & Creative Tools',
  'webflow': 'Design & Creative Tools',

  // Fintech & Crypto
  'binance': 'Fintech & Crypto',
  'coinbase': 'Fintech & Crypto',
  'kraken': 'Fintech & Crypto',
  'mastercard': 'Fintech & Crypto',
  'revolut': 'Fintech & Crypto',
  'stripe': 'Fintech & Crypto',
  'wise': 'Fintech & Crypto',

  // E-commerce & Retail
  'airbnb': 'E-commerce & Retail',
  'meta': 'E-commerce & Retail',
  'nike': 'E-commerce & Retail',
  'shopify': 'E-commerce & Retail',
  'starbucks': 'E-commerce & Retail',

  // Media & Consumer Tech
  'apple': 'Media & Consumer Tech',
  'hp': 'Media & Consumer Tech',
  'ibm': 'Media & Consumer Tech',
  'nvidia': 'Media & Consumer Tech',
  'pinterest': 'Media & Consumer Tech',
  'playstation': 'Media & Consumer Tech',
  'spacex': 'Media & Consumer Tech',
  'spotify': 'Media & Consumer Tech',
  'theverge': 'Media & Consumer Tech',
  'uber': 'Media & Consumer Tech',
  'vodafone': 'Media & Consumer Tech',
  'wired': 'Media & Consumer Tech',

  // Automotive
  'bmw': 'Automotive',
  'bmw-m': 'Automotive',
  'bugatti': 'Automotive',
  'ferrari': 'Automotive',
  'lamborghini': 'Automotive',
  'renault': 'Automotive',
  'tesla': 'Automotive',

  // Productivity & Collaboration
  'cal': 'Productivity & Collaboration',
  'intercom': 'Productivity & Collaboration',
  'lovable': 'Productivity & Collaboration',
  'notion': 'Productivity & Collaboration',
  'slack': 'Productivity & Collaboration',
  'superhuman': 'Productivity & Collaboration',
  'zapier': 'Productivity & Collaboration',

  // Retro Web · DESIGN.md Nostalgia
  'dell-1996': 'Retro Web',
  'nintendo-2001': 'Retro Web'
};

// Clean brand display names
const DISPLAY_NAMES = {
  'linear.app': 'Linear',
  'mistral.ai': 'Mistral AI',
  'opencode.ai': 'OpenCode AI',
  'runwayml': 'Runway',
  'together.ai': 'Together AI',
  'x.ai': 'xAI',
  'dell-1996': 'Dell (1996)',
  'nintendo-2001': 'Nintendo (2001)',
  'bmw-m': 'BMW M',
  'theverge': 'The Verge',
  'cal': 'Cal.com',
  'spacex': 'SpaceX',
  'hp': 'HP',
  'ibm': 'IBM'
};

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { meta: {}, body: content };

  const yamlStr = match[1];
  const meta = {};

  // Simple, resilient line-by-line key/value parser for frontmatter
  const lines = yamlStr.split('\n');
  let currentKey = null;
  let inColors = false;
  let inTypography = false;
  const colors = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (line.startsWith('colors:')) {
      inColors = true;
      inTypography = false;
      continue;
    }
    if (line.startsWith('typography:') || line.startsWith('components:')) {
      inColors = false;
      inTypography = true;
      continue;
    }

    if (inColors) {
      const cMatch = line.match(/^\s+([a-zA-Z0-9_-]+):\s*["']?([^"'\s]+)["']?/);
      if (cMatch) {
        colors[cMatch[1]] = cMatch[2];
      }
      continue;
    }

    const kvMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kvMatch && !line.startsWith(' ')) {
      const key = kvMatch[1];
      let val = kvMatch[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
  }

  meta.colors = colors;
  return { meta, body: content.slice(match[0].length) };
}

// Domain-specific tag dictionary for high-accuracy matching
const DOMAIN_KEYWORDS = {
  'linear.app': ['issue', 'issues', 'tracker', 'tracking', 'project', 'management', 'tasks', 'tickets', 'kanban', 'scrum', 'agile', 'engineering', 'sprint', 'backlog', 'keyboard-first', 'dark mode'],
  'stripe': ['payments', 'billing', 'checkout', 'invoicing', 'subscriptions', 'finance', 'fintech', 'developer', 'platform', 'gradients'],
  'supabase': ['database', 'postgres', 'backend', 'auth', 'storage', 'firebase', 'alternative', 'sql', 'developer', 'realtime'],
  'sentry': ['error', 'monitoring', 'crash', 'reporting', 'observability', 'telemetry', 'logging', 'debugging', 'metrics', 'alerts'],
  'posthog': ['analytics', 'product', 'session', 'recording', 'feature', 'flags', 'telemetry', 'tracking', 'ab testing'],
  'cal': ['scheduling', 'calendar', 'bookings', 'appointments', 'meetings', 'availability'],
  'shopify': ['ecommerce', 'store', 'shop', 'cart', 'retail', 'products', 'merchants', 'checkout'],
  'airbnb': ['travel', 'vacation', 'rentals', 'hospitality', 'marketplace', 'bookings', 'hotels'],
  'cursor': ['code', 'editor', 'ide', 'ai', 'coding', 'developer', 'programming', 'vscode'],
  'raycast': ['launcher', 'productivity', 'shortcuts', 'spotlight', 'extensions', 'command', 'palette'],
  'superhuman': ['email', 'inbox', 'mail', 'messaging', 'keyboard', 'shortcuts', 'speed'],
  'slack': ['chat', 'messaging', 'team', 'collaboration', 'channels', 'communication', 'threads'],
  'notion': ['docs', 'wiki', 'notes', 'knowledge', 'base', 'workspace', 'productivity'],
  'claude': ['ai', 'assistant', 'chatbot', 'llm', 'anthropic', 'editorial', 'conversational'],
  'vercel': ['frontend', 'deployment', 'nextjs', 'hosting', 'cloud', 'platform', 'serverless', 'edge'],
  'clickhouse': ['analytics', 'database', 'olap', 'big data', 'real-time', 'sql', 'columnar']
};

function parseReadmeCatalog(readmeContent) {
  const brandInfo = {};
  let currentCategory = 'General';
  const lines = readmeContent.split('\n');

  for (const line of lines) {
    if (line.startsWith('### ')) {
      currentCategory = line.slice(4).trim();
      continue;
    }
    const match = line.match(/^-\s+\[\*\*([^*]+)\*\*\]\(https:\/\/getdesign\.md\/([^/]+)\/design-md\)\s*-\s*(.+)$/);
    if (match) {
      const name = match[1].trim();
      const slug = match[2].trim().toLowerCase();
      const desc = match[3].trim();
      brandInfo[slug] = { name, category: currentCategory, summary: desc };
    }
  }
  return brandInfo;
}

function extractKeywords(id, name, category, description, readmeSummary) {
  const set = new Set();
  set.add(id.toLowerCase().replace(/[^a-z0-9]/g, ' '));
  set.add(name.toLowerCase());
  
  category.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2).forEach(w => set.add(w));

  if (DOMAIN_KEYWORDS[id]) {
    DOMAIN_KEYWORDS[id].forEach(k => set.add(k));
  }

  const combined = `${description || ''} ${readmeSummary || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['this', 'that', 'with', 'from', 'over', 'into', 'under', 'system', 'design', 'brand'].includes(w));
  
  combined.slice(0, 30).forEach(w => set.add(w));

  return Array.from(set).filter(Boolean);
}

function sync() {
  console.log('🔄 Dev-OS Design Catalog Synchronizer');
  console.log(`Source repository: ${REPO_URL}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devos-design-sync-'));
  try {
    console.log(`📥 Fetching latest catalog into temporary cache...`);
    spawnSync('git', ['clone', '--depth', '1', REPO_URL, tmpDir], { stdio: 'ignore' });

    const sourceDesignDir = path.join(tmpDir, 'design-md');
    if (!fs.existsSync(sourceDesignDir)) {
      throw new Error(`Expected directory 'design-md' not found in cloned repo.`);
    }

    // Read and parse README.md if present
    const readmeFile = path.join(tmpDir, 'README.md');
    const readmeData = fs.existsSync(readmeFile) ? parseReadmeCatalog(fs.readFileSync(readmeFile, 'utf8')) : {};

    // Ensure catalog directories exist
    fs.mkdirSync(SYSTEMS_DIR, { recursive: true });

    const brandFolders = fs.readdirSync(sourceDesignDir).filter(f => {
      const fullPath = path.join(sourceDesignDir, f);
      return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'DESIGN.md'));
    });

    console.log(`📦 Found ${brandFolders.length} brand design systems.`);

    const index = [];

    for (const folder of brandFolders) {
      const srcDesignFile = path.join(sourceDesignDir, folder, 'DESIGN.md');
      const content = fs.readFileSync(srcDesignFile, 'utf8');
      const { meta } = parseYamlFrontmatter(content);

      const id = folder.toLowerCase();
      const readmeEntry = readmeData[id] || readmeData[id.replace(/\.app$/, '')] || {};
      const displayName = DISPLAY_NAMES[id] || readmeEntry.name || meta.name?.replace(/-design-analysis$/i, '') || id.charAt(0).toUpperCase() + id.slice(1);
      const category = readmeEntry.category || CATEGORY_MAP[id] || 'General & Enterprise';
      const summary = readmeEntry.summary || meta.description || `Design system for ${displayName}.`;
      const primaryColor = meta.colors?.primary || meta.colors?.accent || '#2563EB';
      const backgroundColor = meta.colors?.canvas || meta.colors?.background || meta.colors?.['brand-dark-900'] || '#0d0e11';

      // Create target directory in .agents/catalog/design-systems/systems/<id>/
      const targetSystemDir = path.join(SYSTEMS_DIR, id);
      fs.mkdirSync(targetSystemDir, { recursive: true });
      const targetDesignFile = path.join(targetSystemDir, 'DESIGN.md');
      fs.writeFileSync(targetDesignFile, content, 'utf8');

      // Index entry
      const keywords = extractKeywords(id, displayName, category, meta.description, readmeEntry.summary);
      index.push({
        id,
        name: displayName,
        category,
        summary: summary.slice(0, 220) + (summary.length > 220 ? '...' : ''),
        keywords,
        primaryColor,
        backgroundColor,
        path: `systems/${id}/DESIGN.md`
      });
    }

    // Sort index alphabetically by name
    index.sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + '\n', 'utf8');
    console.log(`✅ Successfully cataloged ${index.length} design systems in ${INDEX_FILE}`);

    // Print breakdown by category
    const categoryCounts = {};
    for (const item of index) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }

    console.log('\n📊 Category Breakdown:');
    for (const [cat, count] of Object.entries(categoryCounts)) {
      console.log(`  - ${cat.padEnd(30)}: ${count} systems`);
    }

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  sync();
}

module.exports = { sync, parseYamlFrontmatter };
