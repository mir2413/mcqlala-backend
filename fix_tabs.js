const fs = require('fs');

// Fix admin.html: replace [event, 'tab-name'] with ["tab-name"]
let html = fs.readFileSync('e:/New folder (3)/admin.html', 'utf8');
const htmlBefore = html;
html = html.replace(/data-args="\[event,\s*'([^']+)'\]"/g, 'data-args="[&quot;$1&quot;]"');
if (html !== htmlBefore) console.log('Fixed admin.html');
else console.log('No changes needed in admin.html');
fs.writeFileSync('e:/New folder (3)/admin.html', html);

// Fix admin_inline.js too
let js = fs.readFileSync('e:/New folder (3)/admin_inline.js', 'utf8');
const jsBefore = js;
js = js.replace(/data-args="\[event,\s*'([^']+)'\]"/g, 'data-args="[&quot;$1&quot;]"');
if (js !== jsBefore) console.log('Fixed admin_inline.js');
else console.log('No changes needed in admin_inline.js');
fs.writeFileSync('e:/New folder (3)/admin_inline.js', js);

// Also update the switchTab function to not require event as first arg
// The delegator passes event automatically
js = fs.readFileSync('e:/New folder (3)/admin_inline.js', 'utf8');
js = js.replace(
    'function switchTab(e, tabName) {',
    'function switchTab(tabNameOrEvent, tabName) {\n            // Handle both direct call and delegator call\n            if (tabNameOrEvent && typeof tabNameOrEvent === "string" && !tabName) {\n                tabName = tabNameOrEvent;\n            }'
);
fs.writeFileSync('e:/New folder (3)/admin_inline.js', js);

// Bump cache version in admin.html
const v = Date.now();
html = fs.readFileSync('e:/New folder (3)/admin.html', 'utf8');
html = html.replace(/admin_inline\.js\?v=\d+/g, 'admin_inline.js?v=' + v);
html = html.replace(/app\.js\?v=\d+/g, 'app.js?v=' + v);
fs.writeFileSync('e:/New folder (3)/admin.html', html);

console.log('All done! Version bumped to ' + v);
