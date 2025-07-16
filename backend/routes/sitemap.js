import express from 'express';
import { SitemapGenerator } from '../utils/sitemapGenerator.js';

const router = express.Router();

// Initialize sitemap generator
const sitemapGenerator = new SitemapGenerator(process.env.BASE_URL || 'https://shareme.bio');

// Generate sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await sitemapGenerator.generateSitemap();
    
    // Set content type and send response
    res.set('Content-Type', 'application/xml');
    res.send(xml);
    
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Generate sitemap index
router.get('/sitemap-index.xml', async (req, res) => {
  try {
    const xml = sitemapGenerator.generateSitemapIndex();
    
    res.set('Content-Type', 'application/xml');
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