const fs = require('fs');

const content = fs.readFileSync('scratch/mio_api_doc.html', 'utf8');
const urls = content.match(/data-url="([^"]+)"/g) || [];
const uniqueUrls = Array.from(new Set(urls.map(u => u.replace('data-url="', '').replace('"', ''))));

console.log('All endpoints in MIO:');
uniqueUrls.forEach(u => console.log(' - ' + u));
