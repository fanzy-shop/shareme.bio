import express from 'express';
import { verifyAuthToken, getUser, getUserPosts } from '../utils/telegramBot.js';
import { getPage } from '../models/pageStore.js';

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
    
    // Store user info in session
    req.session.user = {
      telegramId,
      name: user.name
    };
    
    console.log(`Authentication successful for user: ${user.name}`);
    
    // Redirect to dashboard
    res.redirect('/dashboard');
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
    // Check if user is logged in
    if (!req.session.user) {
      console.log('Dashboard access denied: Not logged in');
      return res.redirect('/');
    }
    
    const user = req.session.user;
    console.log(`Dashboard access for user: ${user.name}`);
    
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

// Logout route
router.get('/logout', (req, res) => {
  if (req.session.user) {
    console.log(`Logout for user: ${req.session.user.name}`);
  }
  req.session.destroy();
  res.redirect('/');
});

export default router; 