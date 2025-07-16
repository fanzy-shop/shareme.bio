import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import publishRoutes from './routes/publish.js';
import { router as readRouter, editRouter } from './routes/read.js';
import authRoutes from './routes/auth.js';
import sitemapRoutes from './routes/sitemap.js';
import './utils/telegramBot.js'; // Import to initialize the bot
import redis from './redis.js'; // Import the existing Redis client

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Set base URL for the application
process.env.BASE_URL = process.env.BASE_URL || 'https://shareme.bio';

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

// Initialize Redis store with proper configuration
const redisStore = new RedisStore({
  client: redis,
  prefix: 'session:',
  disableTouch: false, // Enable touch to keep sessions alive
  ttl: 86400 // 1 day in seconds
});

// Session middleware with proper configuration
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET || 'shareme-telegraph-clone-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true only if using HTTPS
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
  }
}));

// Body parser and static middleware
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Debug middleware to log session data
app.use((req, res, next) => {
  console.log('Session ID:', req.sessionID);
  console.log('Session User:', req.session.user);
  next();
});

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  // Add current URL for social media previews
  res.locals.currentUrl = `${process.env.BASE_URL}${req.originalUrl}`;
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Apply routes in correct order
// 1. Auth routes first
app.use(authRoutes);

// 2. Sitemap routes (before other routes)
app.use(sitemapRoutes);

// 3. Specific routes
app.get('/', (req, res) => res.render('editor', { page: null }));
app.get('/new', (req, res) => {
  // If user is logged in, pre-fill author name
  const author = req.session.user ? req.session.user.name : '';
  res.render('editor', { page: null, author });
});

// 4. Edit routes (must come before general slug routes)
app.use('/edit', editRouter);

// 5. Publish routes
app.use(publishRoutes);

// 6. General read routes (for viewing pages by slug)
app.use(readRouter);

// Handle 404 errors
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).render('404');
});

// Handle server errors
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    message: 'An unexpected error occurred. Please try again later.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: ${process.env.BASE_URL}`);
}); 