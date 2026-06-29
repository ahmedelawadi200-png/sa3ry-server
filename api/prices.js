export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  // Determine price range based on product type
  const productLower = q.toLowerCase();
  let minPrice = 500;
  let maxPrice = 300000;

  if (productLower.includes('iphone') || productLower.includes('samsung') || productLower.includes('موبايل')) {
    minPrice = 8000; maxPrice = 150000;
  } else if (productLower.includes('laptop') || productLower.includes('لابتوب') || productLower.includes('macbook')) {
    minPrice = 15000; maxPrice = 200000;
  } else if (productLower.includes('tv') || productLower.includes('تليفزيون') || productLower.includes('شاشة')) {
    minPrice = 5000; maxPrice = 150000;
  } else if (productLower.includes('airpods') || productLower.includes('سماعة') || productLower.includes('earbuds')) {
    minPrice = 500; maxPrice = 20000;
  } else if (productLower.includes('watch') || productLower.includes('ساعة')) {
    minPrice = 2000; maxPrice = 80000;
  }

  const stores = [
    { name: 'أمازون مصر', url: `https://www.amazon.eg/s?k=${encodeURIComponent(q)}&sort=relevancerank` },
    { name: 'جوميا', url: `https://www.jumia.com.eg/catalog/?q=${encodeURIComponent(q)}` },
    { name: 'نون', url: `https://www.noon.com/egypt-ar/search/?q=${encodeURIComponent(q)}` },
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
        signal: AbortSignal.timeout(10000)
      });

      const html = await response.text();
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
          if (price >= minPrice && price <= maxPrice) {
            allPrices.push(price);
          }
          if (allPrices.length >= 30) break;
        }
      }

      if (allPrices.length > 0) {
        allPrices.sort((a, b) => a - b);
        // Take median price
        const medianIndex = Math.floor(allPrices.length / 2);
        const price = allPrices[medianIndex];
        const minP = allPrices[0];
        const maxP = allPrices[allPrices.length - 1];
        
        results.push({ 
          store: store.name, 
          price,
          minPrice: minP,
          maxPrice: maxP,
          link: store.url
        });
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
