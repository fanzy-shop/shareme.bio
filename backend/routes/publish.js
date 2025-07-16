import express from 'express';
import { nanoid } from 'nanoid';
import xss from 'xss';
import { savePage, updatePage, getPage } from '../models/pageStore.js';
import { slugify } from '../utils/slugify.js';
import { addPostToUser } from '../utils/telegramBot.js';

const router = express.Router();

router.post('/publish', async (req, res) => {
  const { slug, editToken, title, content, author } = req.body;
  const cleanTitle = xss(title.trim().slice(0, 120));
  const cleanContent = xss(content, { whiteList: xss.whiteList, css: false });
  const cleanAuthor = author ? xss(author.trim().slice(0, 50)) : '';

  // Get user ID if logged in
  const telegramId = req.session?.user?.telegramId;

  // New page
  if (!slug) {
    // Generate slug from title with a random suffix for uniqueness
    const titleSlug = slugify(cleanTitle);
    const randomSuffix = nanoid(4);
    const newSlug = `${titleSlug}-${randomSuffix}`;
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