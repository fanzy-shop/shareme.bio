import { getRecent } from '../models/pageStore.js';

export class SitemapGenerator {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  // Generate main sitemap with all pages
  async generateSitemap() {
    try {
      const pages = await getRecent(1000);
      
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // Add static pages
      const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/new', priority: '0.8', changefreq: 'weekly' },
        { url: '/dashboard', priority: '0.6', changefreq: 'weekly' }
      ];
      
      // Add static pages to sitemap
      staticPages.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${this.baseUrl}${page.url}</loc>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += '  </url>\n';
      });
      
      // Add dynamic pages (only if pages exist and are valid)
      if (pages && Array.isArray(pages)) {
        pages.forEach(page => {
          if (page && page.slug) {
            const lastmod = page.createdAt ? new Date(parseInt(page.createdAt)).toISOString() : new Date().toISOString();
            
            xml += '  <url>\n';
            xml += `    <loc>${this.baseUrl}/${page.slug}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += '    <priority>0.7</priority>\n';
            xml += '    <changefreq>monthly</changefreq>\n';
            xml += '  </url>\n';
          }
        });
      }
      
      xml += '</urlset>';
      return xml;
      
    } catch (error) {
      console.error('Error generating sitemap:', error);
      // Return a basic sitemap with just static pages
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      const staticPages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/new', priority: '0.8', changefreq: 'weekly' },
        { url: '/dashboard', priority: '0.6', changefreq: 'weekly' }
      ];
      
      staticPages.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${this.baseUrl}${page.url}</loc>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += '  </url>\n';
      });
      
      xml += '</urlset>';
      return xml;
    }
  }

  // Generate sitemap index
  generateSitemapIndex() {
    try {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      xml += '  <sitemap>\n';
      xml += `    <loc>${this.baseUrl}/sitemap.xml</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
      xml += '  </sitemap>\n';
      xml += '</sitemapindex>';
      
      return xml;
      
    } catch (error) {
      console.error('Error generating sitemap index:', error);
      throw error;
    }
  }

  // Generate robots.txt content
  generateRobotsTxt() {
    return `# Robots.txt for www.ShareMe.bio

User-agent: *
Allow: /
Disallow: /auth/
Disallow: /edit/
Disallow: /dashboard
Disallow: /api/
Disallow: /publish
Disallow: /custom-url
Disallow: /check-url
Disallow: /success

# Allow sitemap access
Allow: /sitemap.xml
Allow: /sitemap-index.xml
Allow: /robots.txt

# Crawl delays
Crawl-delay: 5

# Specific bot rules
User-agent: Googlebot
Crawl-delay: 2

User-agent: Bingbot
Crawl-delay: 3

# Sitemap location
Sitemap: ${this.baseUrl}/sitemap.xml
Sitemap: ${this.baseUrl}/sitemap-index.xml

# Block bad bots
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: BLEXBot
Disallow: /`;
  }
} 