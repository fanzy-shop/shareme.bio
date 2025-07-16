import express from 'express';
import { getPage, incrementViews } from '../models/pageStore.js';

// Create separate routers
const router = express.Router();
const editRouter = express.Router();

// View page route
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    console.log(`Viewing page with slug: ${slug}`);
    
    if (!slug || slug.trim() === '') {
      console.log('Invalid slug: empty or undefined');
      return res.status(404).render('404');
    }
    
    const page = await getPage(slug);
    
    if (!page) {
      console.log(`Page not found: ${slug}`);
      return res.status(404).render('404');
    }
    
    // Ensure slug is set on the page object
    page.slug = slug;
    
    // Increment view count
    await incrementViews(slug);
    
    // Check if user has permission to edit (either they have the token in localStorage or they are the original creator)
    // This will be handled client-side with localStorage and server-side with session
    const isOriginalCreator = req.session?.user?.telegramId === page.telegramId;
    
    console.log(`Rendering page with slug: ${slug}, title: ${page.title}, has editToken: ${!!page.editToken}`);
    res.render('page', { page, isOriginalCreator });
  } catch (error) {
    console.error(`Error viewing page ${req.params.slug}:`, error);
    res.status(500).render('error', { 
      message: 'An error occurred while loading this page.' 
    });
  }
});

// Edit page route - note this is mounted at /edit in app.js
editRouter.get('/:slug/:token', async (req, res) => {
  try {
    const slug = req.params.slug;
    const token = req.params.token;
    
    console.log(`Edit request for slug: ${slug} with token: ${token}`);
    
    if (!slug || slug.trim() === '') {
      console.log('Invalid slug for editing: empty or undefined');
      return res.status(404).render('404');
    }
    
    const page = await getPage(slug);
    
    if (!page) {
      console.log(`Page not found for editing: ${slug}`);
      return res.status(404).render('404');
    }
    
    // Ensure slug is set on the page object
    page.slug = slug;
    
    // Check if the token is valid
    const hasValidToken = page.editToken === token;
    
    // Check if user is the original creator
    const isOriginalCreator = req.session?.user?.telegramId === page.telegramId;
    
    if (!hasValidToken && !isOriginalCreator) {
      console.log(`Edit permission denied for ${slug}`);
      return res.status(403).render('error', { 
        message: 'You do not have permission to edit this page.' 
      });
    }
    
    console.log(`Edit permission granted for ${slug}, rendering editor with page slug: ${page.slug}`);
    res.render('editor', { page, token });
  } catch (error) {
    console.error(`Error editing page ${req.params.slug}:`, error);
    res.status(500).render('error', { 
      message: 'An error occurred while trying to edit this page.' 
    });
  }
});

export { router, editRouter }; 