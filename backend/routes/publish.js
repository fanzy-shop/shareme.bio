import express from 'express';
import { nanoid } from 'nanoid';
import xss from 'xss';
import { savePage, updatePage, getPage } from '../models/pageStore.js';
import { slugify } from '../utils/slugify.js';
import { addPostToUser, getUserSettings } from '../utils/telegramBot.js';

const router = express.Router();

// Check URL availability
router.post('/check-url', async (req, res) => {
  try {
    const { slug } = req.body;
    
    if (!slug || !slug.trim()) {
      return res.json({ available: false, message: 'URL cannot be empty' });
    }
    
    // Clean and validate the slug
    const cleanSlug = slugify(slug.trim().toLowerCase());
    
    if (cleanSlug.length < 3) {
      return res.json({ available: false, message: 'URL must be at least 3 characters' });
    }
    
    if (cleanSlug.length > 50) {
      return res.json({ available: false, message: 'URL must be less than 50 characters' });
    }
    
    // Check if slug contains only valid characters
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      return res.json({ available: false, message: 'URL can only contain letters, numbers, and hyphens' });
    }
    
    // Check if slug already exists
    const existingPage = await getPage(cleanSlug);
    
    if (existingPage) {
      return res.json({ 
        available: false, 
        message: 'This URL is already taken',
        slug: cleanSlug
      });
    }
    
    return res.json({ 
      available: true, 
      message: 'URL is available',
      slug: cleanSlug
    });
    
  } catch (error) {
    console.error('Error checking URL availability:', error);
    res.status(500).json({ available: false, message: 'Error checking availability' });
  }
});

router.post('/publish', async (req, res) => {
  const { slug, editToken, title, content, author, customSlug } = req.body;
  const cleanTitle = xss(title.trim().slice(0, 120));
  const cleanContent = xss(content, { whiteList: xss.whiteList, css: false });
  
  // Get user ID if logged in
  const telegramId = req.session?.user?.telegramId;
  
  // Determine author name - use provided author or fall back to user settings
  let cleanAuthor = author ? xss(author.trim().slice(0, 50)) : '';
  
  // If no author provided and user is logged in, use their custom author name
  if (!cleanAuthor && telegramId) {
    const settings = await getUserSettings(telegramId);
    cleanAuthor = settings.authorName || req.session.user.name || '';
  }

  // New page
  if (!slug) {
    // Use custom slug if provided, otherwise generate random one
    let newSlug;
    if (customSlug && customSlug.trim()) {
      // Validate custom slug
      const cleanCustomSlug = slugify(customSlug.trim().toLowerCase());
      
      if (cleanCustomSlug.length < 3) {
        return res.status(400).json({ ok: false, error: 'custom_slug_too_short' });
      }
      
      if (cleanCustomSlug.length > 50) {
        return res.status(400).json({ ok: false, error: 'custom_slug_too_long' });
      }
      
      if (!/^[a-z0-9-]+$/.test(cleanCustomSlug)) {
        return res.status(400).json({ ok: false, error: 'custom_slug_invalid' });
      }
      
      // Check if custom slug already exists
      const existingPage = await getPage(cleanCustomSlug);
      if (existingPage) {
        return res.status(400).json({ ok: false, error: 'custom_slug_taken' });
      }
      
      newSlug = cleanCustomSlug;
    } else {
      // Generate short 10-character slug for all URLs
      newSlug = nanoid(10);
    }
    
    const newToken = nanoid(16);
    
    const pageData = { 
      slug: newSlug, 
      title: cleanTitle, 
      content: cleanContent, 
      author: cleanAuthor,
      createdAt: Date.now(), 
      editToken: newToken,
      views: 0
    };
    
    // Add telegramId if user is logged in
    if (telegramId) {
      pageData.telegramId = telegramId;
      // Add post to user's posts
      await addPostToUser(telegramId, newSlug);
    }
    
    await savePage(pageData);
    return res.json({ ok: true, slug: newSlug, token: newToken });
  }

  // Edit existing
  const page = await getPage(slug);
  if (!page) return res.status(404).json({ ok: false, error: 'not_found' });
  
  // Check if user has permission to edit
  // Either they have the edit token or they are the original creator
  const hasEditToken = page.editToken === editToken;
  const isOriginalCreator = telegramId && page.telegramId === telegramId;
  
  if (!hasEditToken && !isOriginalCreator) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  await updatePage(slug, { 
    title: cleanTitle, 
    content: cleanContent,
    author: cleanAuthor
  });
  res.json({ ok: true, slug, token: page.editToken });
});

export default router; 