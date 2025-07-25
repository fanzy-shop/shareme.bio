import express from 'express';
import { SitemapGenerator } from '../utils/sitemapGenerator.js';

const router = express.Router();

// Create sitemap generator with the base URL
const sitemapGenerator = new SitemapGenerator(process.env.BASE_URL || 'https://www.shareme.bio');

// Generate sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await sitemapGenerator.generateSitemap();
    
    // Set content type and send response
    res.set('Content-Type', 'application/xml');
    res.send(xml);
    
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return a basic sitemap instead of error
    const basicXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${process.env.BASE_URL || 'https://www.shareme.bio'}/</loc>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>
</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.send(basicXml);
  }
});

// Generate sitemap index
router.get('/sitemap-index.xml', async (req, res) => {
  try {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${process.env.BASE_URL || 'https://www.shareme.bio'}/sitemap.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;
    
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    res.status(500).send('Error generating sitemap index');
  }
});

// Serve robots.txt dynamically
router.get('/robots.txt', async (req, res) => {
  try {
    const robotsTxt = sitemapGenerator.generateRobotsTxt();
    
    res.set('Content-Type', 'text/plain');
    res.send(robotsTxt);
    
  } catch (error) {
    console.error('Error generating robots.txt:', error);
    res.status(500).send('Error generating robots.txt');
  }
});

export default router; 