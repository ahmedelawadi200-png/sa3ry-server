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
    { 
      name: 'أمازون مصر', 
      url: `https://www.amazon.eg/s?k=${encodeURIComponent(q)}&sort=relevancerank`,
      minPrice: 1000
    },
    { 
      name: 'جوميا', 
      url: `https://www.jumia.com.eg/catalog/?q=${encodeURIComponent(q)}`,
      minPrice: 1000
    },
    {
      name: 'نون',
      url: `https://www.noon.com/egypt-ar/search/?q=${encodeURIComponent(q)}`,
      minPrice: 1000
    }
  ];

  const results = [];

  for (const store of stores) {
    try {
      const response = await fetch(store.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ar-EG,ar;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(8000)
      });

      const html = await response.text();

      // Extract ALL prices from page
      const allPrices = [];
      
      const patterns = [
        /(\d{1,3}(?:[,،]\d{3})+(?:\.\d{2})?)\s*(?:جنيه|ج\.م|EGP|LE)/gi,
        /EGP\s*([0-9,،]+(?:\.[0-9]+)?)/gi,
        /"price":\s*"?([0-9,،.]+)"?/gi,
        /class="[^"]*price[^"]*"[^>]*>\s*(?:EGP\s*)?([0-9,،]+)/gi,
      ];

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const price = parseInt(match[1].replace(/[,،]/g, ''));
          // Filter: must be realistic product price (not accessory)
          if (price >= store.minPrice && price <= 300000) {
            allPrices.push(price);
          }
          if (allPrices.length >= 20) break;
        }
      }

      if (allPrices.length > 0) {
        // Sort prices and take the median to avoid outliers
        allPrices.sort((a, b) => a - b);
        
        // Remove top 20% (might be premium accessories) and bottom 10% (might be wrong)
        const start = Math.floor(allPrices.length * 0.1);
        const end = Math.floor(allPrices.length * 0.7);
        const filtered = allPrices.slice(start, end + 1);
        
        if (filtered.length > 0) {
          // Take the most common price range (first quartile of filtered)
          const price = filtered[Math.floor(filtered.length * 0.25)];
          results.push({ 
            store: store.name, 
            price, 
            link: store.url,
            priceRange: {
              min: Math.min(...filtered),
              max: Math.max(...filtered)
            }
          });
        }
      }
    } catch(e) {
      console.log(`${store.name} failed:`, e.message);
    }
  }

  return res.status(200).json({ 
    results, 
    query: q, 
    count: results.length,
    note: results.length === 0 ? 'لم يتم العثور على أسعار' : 'تم جلب الأسعار'
  });
}
