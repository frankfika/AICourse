const fs = require('fs');

const files = ['App.tsx', 'components/AiTutor.tsx'];

const replaceMap = {
    // text colors
    'text-slate-900': 'text-[#171717]',
    'text-slate-800': 'text-[#171717]',
    'text-slate-700': 'text-[#171717]',
    'text-slate-600': 'text-[#171717]',
    'text-slate-500': 'text-[#666666]',
    'text-slate-400': 'text-[#999999]',
    'text-slate-300': 'text-[#999999]',
    'text-slate-200': 'text-[#EEEDE9]',
    'text-brand-700': 'text-[#171717]',
    'text-brand-600': 'text-[#171717]',
    'text-brand-500': 'text-[#171717]',
    'text-brand-400': 'text-[#666666]',
    'text-brand-300': 'text-[#999999]',
    'text-brand-200': 'text-[#999999]',
    'text-brand-100': 'text-[#EEEDE9]',
    'text-brand-50': 'text-[#F5F4F0]',
    'text-amber-700': 'text-[#171717]',
    'text-indigo-600': 'text-[#171717]',
    
    // border colors
    'border-slate-800': 'border-[#171717]',
    'border-slate-700': 'border-[#171717]',
    'border-slate-600': 'border-[#171717]',
    'border-slate-500': 'border-[#666666]',
    'border-slate-400': 'border-[#999999]',
    'border-slate-300': 'border-[#EEEDE9]',
    'border-slate-200': 'border-[#EEEDE9]',
    'border-slate-100': 'border-[#EEEDE9]',
    'border-slate-50': 'border-[#EEEDE9]',
    'border-brand-600': 'border-[#171717]',
    'border-brand-500': 'border-[#171717]',
    'border-brand-400': 'border-[#666666]',
    'border-brand-300': 'border-[#999999]',
    'border-brand-200': 'border-[#EEEDE9]',
    'border-brand-100': 'border-[#EEEDE9]',
    'border-amber-200': 'border-[#EEEDE9]',

    // hover borders
    'hover:border-brand-200': 'hover:border-[#171717]',
    'hover:border-slate-200': 'hover:border-[#171717]',

    // bg colors
    'bg-slate-900': 'bg-[#171717]',
    'bg-slate-800': 'bg-[#171717]',
    'bg-slate-700': 'bg-[#666666]',
    'bg-slate-600': 'bg-[#666666]',
    'bg-slate-500': 'bg-[#999999]',
    'bg-slate-400': 'bg-[#999999]',
    'bg-slate-300': 'bg-[#EEEDE9]',
    'bg-slate-200': 'bg-[#EEEDE9]',
    'bg-slate-100': 'bg-[#F5F4F0]',
    'bg-slate-50': 'bg-[#F5F4F0]',
    'bg-brand-700': 'bg-[#171717]',
    'bg-brand-600': 'bg-[#171717]',
    'bg-brand-500': 'bg-[#171717]',
    'bg-brand-400': 'bg-[#666666]',
    'bg-brand-300': 'bg-[#999999]',
    'bg-brand-200': 'bg-[#EEEDE9]',
    'bg-brand-100': 'bg-[#F5F4F0]',
    'bg-brand-50': 'bg-[#F5F4F0]',
    'bg-amber-100': 'bg-[#F5F4F0]',

    // group hover text
    'group-hover:text-brand-600': 'group-hover:text-[#171717]',

    // group hover bg
    'group-hover:bg-brand-600': 'group-hover:bg-[#EEEDE9]',

    // other hover
    'hover:text-slate-800': 'hover:text-[#171717]',
    'hover:text-slate-700': 'hover:text-[#171717]',
    'hover:text-slate-600': 'hover:text-[#171717]',
    'hover:bg-slate-200': 'hover:bg-[#EEEDE9]',
    'hover:bg-slate-50': 'hover:bg-[#EEEDE9]',
    'hover:bg-brand-100': 'hover:bg-[#EEEDE9]',
    'hover:bg-brand-700': 'hover:bg-[#171717]',
};

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Simple string replacements
    for (const [oldClass, newClass] of Object.entries(replaceMap)) {
        // use regex with word boundaries
        const regex = new RegExp(`\\b${oldClass.replace(/:/g, '\\:')}\\b`, 'g');
        content = content.replace(regex, newClass);
    }
    
    // Remove complex unwanted classes
    const toRemove = [
        /shadow-xl/g, /shadow-lg/g, /shadow-md/g, /shadow-sm/g, /shadow-2xl/g, /shadow-brand-600\/30/g,
        /ring-1/g, /ring-black\/5/g, /focus-within:ring-2/g, /focus-within:ring-brand-200/g,
        /hover:-translate-y-1/g, /hover:scale-105/g, /transition-transform/g, /transition-all/g, /transition-colors/g,
        /backdrop-blur-sm/g, /backdrop-blur-md/g, /bg-white\/5/g, /border-white\/10/g,
        /bg-gradient-to-t/g, /from-slate-900/g, /via-slate-900\/80/g, /to-slate-900\/60/g,
        /bg-slate-900\/60/g, /bg-brand-500\/20/g, /border-brand-400\/30/g, /bg-slate-50\/80/g
    ];
    
    toRemove.forEach(regex => {
        content = content.replace(regex, '');
    });

    // Clean up multiple spaces left behind
    content = content.replace(/ {2,}/g, ' ');
    // Clean up trailing spaces in class names
    content = content.replace(/ className="([^"]*?) "/g, ' className="$1"');

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Processed ${file}`);
});
