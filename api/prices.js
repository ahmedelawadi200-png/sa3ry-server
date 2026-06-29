export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  const stores = [
    { name: 'بي تك', url: `https://www.btech.com/ar/catalogsearch/result/?q=${encodeURIComponent(q)}` },
    { name: 'نون', url: `https://www.noon.com/egypt-ar/search/?q=${encodeURIComponent(q)}` },
    { name: 'أمازون مصر', url: `https://www.amazon.eg/s?k=${encodeURIComponent(q)}` },
    { name: 'جوميا', url: `https://www.jumia.com.eg/catalog/?q=${encodeURIComponent(q)}` },
  ];

  const results = [];

  for (const store of stores) {
    try {
      const response = await fetch(store.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000)
      });

      const html = await response.text();

      // Extract prices using multiple patterns
      const patterns = [
        /(\d{3,6}(?:[,\.]\d{3})*)\s*(?:جنيه|ج\.م|EGP|LE)/gi,
        /"price"[:\s]+"?(\d{3,6})"?/gi,
        /class="[^"]*price[^"]*"[^>]*>\s*(?:EGP\s*)?([0-9,]{3,})/gi,
        /(\d{3,6})\s*EGP/gi,
      ];

      let price = 0;
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(html);
        if (match) {
          const extracted = parseInt(match[1].replace(/[,\.]/g, ''));
          if (extracted >= 500 && extracted <= 300000) {
            price = extracted;
            break;
          }
        }
      }

      if (price > 0) {
        results.push({ store: store.name, price, link: store.url });
      }
    } catch(e) {
      console.log(`${store.name} failed:`, e.message);
    }
  }

  return res.status(200).json({ results, query: q, count: results.length });
}
