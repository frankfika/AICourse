const fs = require('fs');

const content = `
## Part 3 — Dinq Brutalist Minimal

Use this voice for extreme minimalism, stark contrast, grid-heavy (Bento), wireframe-like designs.

### Design Philosophy

1. **Stark Contrast** — Off-white backgrounds (\`#F5F4F0\`) with near-black text (\`#171717\`). No gradients.
2. **Wireframe Structure** — Heavy use of visible borders (\`#EEEDE9\` or \`#171717\` for emphasis). Everything is contained in explicitly bordered boxes (Bento grid).
3. **Zero Shadows** — Utterly flat. Depth is created by overlapping borders or high-contrast fill colors, never drop shadows or blur.
4. **Bold Typography** — Massive, heavily weighted fonts for headings. Very structured, sometimes monospace for labels.
5. **Asymmetry & Whitespace** — Unconventional grid layouts, huge paddings next to tightly packed info.

### Tokens

\`\`\`css
:root {
  --color-bg:      #F5F4F0;
  --color-surface: #FFFFFF;
  --color-inverse: #171717;

  --color-text-1:  #171717;
  --color-text-2:  #666666;
  --color-text-3:  #999999;
  --color-text-inverse: #FFFFFF;

  --color-border-light: #EEEDE9;
  --color-border-dark:  #171717;
}
\`\`\`

### Core Layout Patterns

#### Brutalist Bento Grid
Use CSS Grid with explicit borders to create a bento box layout.
\`\`\`tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-l border-[#EEEDE9] bg-[#F5F4F0] p-4 md:p-8">
  <div className="col-span-1 md:col-span-2 bg-white border border-[#EEEDE9] p-8 min-h-[300px] flex flex-col justify-between">
    <div className="text-xs font-bold tracking-widest text-[#999999] uppercase mb-4">Featured</div>
    <h3 className="text-4xl md:text-6xl font-black text-[#171717] leading-tight tracking-tighter">Bento Item 1</h3>
  </div>
  <div className="col-span-1 bg-[#171717] border border-[#171717] p-8 text-white flex flex-col justify-between">
    <div className="text-xs font-bold tracking-widest text-[#999999] uppercase mb-4">Stats</div>
    <div className="text-6xl font-black">99%</div>
  </div>
</div>
\`\`\`

#### Brutalist Buttons
\`\`\`tsx
// Primary
<button className="bg-[#171717] text-white px-8 py-4 font-bold text-lg hover:bg-black transition-colors rounded-none border border-[#171717]">
  Action
</button>

// Secondary / Outline
<button className="bg-transparent border border-[#171717] text-[#171717] px-8 py-4 font-bold text-lg hover:bg-[#EEEDE9] transition-colors rounded-none">
  Action
</button>

// Pill variant (if needed)
<button className="bg-[#171717] text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-black transition-colors">
  Action
</button>
\`\`\`

#### Badges / Tags
\`\`\`tsx
<span className="inline-flex items-center px-3 py-1 rounded-full border border-[#EEEDE9] bg-white text-[#171717] text-xs font-bold uppercase tracking-widest">
  Badge
</span>
\`\`\`

### Typography

- Headings should use \`font-black\` or \`font-extrabold\` and \`tracking-tighter\`.
- Labels and meta information should use \`text-xs\`, \`uppercase\`, \`tracking-widest\`, \`font-bold\`, and often a lighter color like \`#999999\`.
- Body text should be readable, medium weight, \`#666666\`.
`;

const file = require('os').homedir() + '/.trae/skills/frontend-design/SKILL.md';
let existing = fs.readFileSync(file, 'utf8');
// remove the corrupted part
existing = existing.substring(0, existing.indexOf('## Part 3 — Dinq Brutalist Minimal'));
if (existing.length === 0) existing = fs.readFileSync(file, 'utf8'); // fallback

fs.writeFileSync(file, existing + content);
console.log('Appended successfully');
