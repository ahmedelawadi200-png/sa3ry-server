const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Store selectors for scraping
const STORES = [
  {
    name: 'بي تك',
    searchUrl: (q) => `https://www.btech.com/ar/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    priceSelector: '.price',
  },
  {
    name: 'نون',
    searchUrl: (q) => `https://www.noon.com/egypt-ar/search/?q=${encodeURIComponent(q)}`,
    priceSelector: '.priceNow',
  },
  {
    name: 'أمازون مصر',
    searchUrl: (q) => `https://www.amazon.eg/s?k=${encodeURIComponent(q)}`,
    priceSelector: '.a-price-whole',
  }
];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { q } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const results = [];
    
    for (const store of STORES) {
      try {
        const response = await fetch(store.searchUrl(q), {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'ar,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml',
          },
          timeout: 8000
        });
        
        const html = await response.text();
        
        // Extract price using regex
        const pricePatterns = [
          /(\d[\d,]+)\s*(?:جنيه|ج\.م|EGP)/gi,
          /"price":\s*"?(\d[\d,\.]+)"?/g,
          /class="price[^"]*"[^>]*>([^<]*(\d[\d,]+)[^<]*)</gi,
        ];
        
        let price = 0;
        for (const pattern of pricePatterns) {
          const match = pattern.exec(html);
          if (match) {
            const extracted = parseInt(match[1].replace(/,/g, ''));
            if (extracted > 100 && extracted < 500000) {
              price = extracted;
              break;
            }
          }
        }
        
        if (price > 0) {
          results.push({
            store: store.name,
            price,
            link: store.searchUrl(q)
          });
        }
      } catch(e) {
        console.error(`Error scraping ${store.name}:`, e.message);
      }
    }
    
    return res.status(200).json({ results, query: q });
    
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
