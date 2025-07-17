import express from 'express';
import { verifyAuthToken, getUser, getUserPosts, removePostFromUser, getUserSettings } from '../utils/telegramBot.js';
import { getPage, deletePage } from '../models/pageStore.js';
import redis from '../redis.js';

const router = express.Router();

// Auth route - handles login from Telegram bot
router.get('/auth/:token', async (req, res) => {
  try {
    const token = req.params.token;
    console.log(`Auth attempt with token: ${token}`);
    
    const telegramId = await verifyAuthToken(token);
    console.log(`Token verification result: ${telegramId ? 'Valid' : 'Invalid'}`);
    
    if (!telegramId) {
      console.log('Authentication failed: Invalid token');
      return res.status(400).render('error', { 
        message: 'Invalid or expired authentication token. Please try again from the Telegram bot.'
      });
    }
    
    // Get user info
    const user = await getUser(telegramId);
    console.log(`User lookup result: ${user ? 'Found' : 'Not found'}`);
    
    if (!user) {
      console.log('Authentication failed: User not found');
      return res.status(404).render('error', { 
        message: 'User not found. Please start the Telegram bot again.'
      });
    }
    
    // Get user settings (including custom author name)
    const settings = await getUserSettings(telegramId);
    const authorName = settings.authorName || user.name;
    
    // Check if there's updated session data from bot
    const sessionUserData = await redis.get(`session_user_${telegramId}`);
    let finalAuthorName = authorName;
    
    if (sessionUserData) {
      try {
        const sessionData = JSON.parse(sessionUserData);
        if (sessionData.authorName) {
          finalAuthorName = sessionData.authorName;
          // Clear the session data after using it
          await redis.del(`session_user_${telegramId}`);
        }
      } catch (error) {
        console.error('Error parsing session user data:', error);
      }
    }
    
    // Store user info in session with custom author name
    req.session.user = {
      telegramId,
      name: user.name,
      authorName: finalAuthorName
    };
    
    console.log(`Authentication successful for user: ${user.name} (Author: ${finalAuthorName})`);
    
    // Save the session explicitly before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).render('error', {
          message: 'An error occurred while saving your session. Please try again.'
        });
      }
      
      console.log('Session saved successfully');
      // Render success page with popup instead of redirecting
      res.render('auth-success', {
        user: { ...user, authorName: finalAuthorName },
        redirectUrl: '/dashboard'
      });
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).render('error', {
      message: 'An error occurred during authentication. Please try again.'
    });
  }
});

// Dashboard route
router.get('/dashboard', async (req, res) => {
  try {
    // Debug session data
    console.log('Dashboard route - Session ID:', req.sessionID);
    console.log('Dashboard route - Session data:', req.session);
    
    // Check if user is logged in
    if (!req.session.user) {
      console.log('Dashboard access denied: Not logged in');
      return res.redirect('/');
    }
    
    const user = req.session.user;
    console.log(`Dashboard access for user: ${user.name} (Author: ${user.authorName})`);
    
    const slugs = await getUserPosts(user.telegramId);
    console.log(`User has ${slugs.length} posts`);
    
    // Get post details
    const posts = await Promise.all(
      slugs.map(async (slug) => {
        const page = await getPage(slug);
        return page ? { 
          slug, 
          title: page.title,
          views: page.views || 0
        } : null;
      })
    );
    
    // Filter out null values
    const validPosts = posts.filter(Boolean);
    
    res.render('dashboard', { 
      user, 
      posts: validPosts
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      message: 'An error occurred while loading your dashboard. Please try again.'
    });
  }
});

// Delete post route
router.post('/delete-post/:slug', async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user) {
      console.log('Delete post access denied: Not logged in');
      return res.status(401).json({ success: false, message: 'Not logged in' });
    }
    
    const slug = req.params.slug;
    const telegramId = req.session.user.telegramId;
    
    console.log(`Delete request for post ${slug} by user ${telegramId}`);
    
    // Get the page
    const page = await getPage(slug);
    
    if (!page) {
      console.log(`Delete failed: Post ${slug} not found`);
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    // Check if user is the original creator
    if (page.telegramId !== telegramId) {
      console.log(`Delete access denied: User ${telegramId} is not the creator of post ${slug}`);
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Delete the page
    await deletePage(slug);
    
    // Remove the post from user's posts list
    await removePostFromUser(telegramId, slug);
    
    console.log(`Post ${slug} deleted successfully`);
    
    // Return success
    res.json({ success: true });
  } catch (error) {
    console.error(`Error deleting post ${req.params.slug}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while deleting the post' 
    });
  }
});

// Logout route
router.get('/logout', (req, res) => {
  if (req.session.user) {
    console.log(`Logout for user: ${req.session.user.name}`);
  }
  req.session.destroy();
  res.redirect('/');
});

export default router; 