import { Telegraf } from 'telegraf';
import { nanoid } from 'nanoid';
import redis from '../redis.js';
import { getPage } from '../models/pageStore.js';

// Initialize bot with token
const bot = new Telegraf('7948218704:AAHJK8KD9BR7eBM5wUT-PMPrMK-PKUWOC9s');

// Redis keys
const USER_PREFIX = 'user:';
const USER_POSTS_PREFIX = 'user_posts:';
const AUTH_TOKEN_PREFIX = 'auth:';

// Base URL for the application
const BASE_URL = 'https://shareme.bio';

// Get user's full name from Telegram user object
function getFullName(user) {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name || user.username || 'Anonymous User';
}

// Store user info in Redis
async function saveUser(telegramId, name) {
  await redis.hSet(USER_PREFIX + telegramId, {
    name,
    createdAt: Date.now()
  });
}

// Get user info from Redis
async function getUser(telegramId) {
  const user = await redis.hGetAll(USER_PREFIX + telegramId);
  return Object.keys(user).length ? user : null;
}

// Add post to user's posts list
async function addPostToUser(telegramId, slug) {
  await redis.sAdd(USER_POSTS_PREFIX + telegramId, slug);
}

// Remove post from user's posts list
async function removePostFromUser(telegramId, slug) {
  await redis.sRem(USER_POSTS_PREFIX + telegramId, slug);
}

// Get user's posts
async function getUserPosts(telegramId) {
  return await redis.sMembers(USER_POSTS_PREFIX + telegramId);
}

// Get user's posts with details
async function getUserPostsWithDetails(telegramId) {
  const slugs = await getUserPosts(telegramId);
  
  // Get details for each post
  const postsWithDetails = await Promise.all(
    slugs.map(async (slug) => {
      const page = await getPage(slug);
      if (!page) return null;
      
      return {
        slug,
        title: page.title,
        views: parseInt(page.views || '0'),
        createdAt: parseInt(page.createdAt)
      };
    })
  );
  
  // Filter out null values and sort by creation date (newest first)
  return postsWithDetails
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Generate auth token and store it
async function generateAuthToken(telegramId) {
  const token = nanoid(32);
  await redis.set(AUTH_TOKEN_PREFIX + token, telegramId, { EX: 86400 }); // Expires in 24 hours
  return token;
}

// Verify auth token and get telegram ID
async function verifyAuthToken(token) {
  const telegramId = await redis.get(AUTH_TOKEN_PREFIX + token);
  // We don't delete the token immediately to allow for retries
  // It will expire naturally after 24 hours
  return telegramId;
}

// Configure bot commands
bot.start(async (ctx) => {
  const { id } = ctx.from;
  const fullName = getFullName(ctx.from);
  
  // Save or update user
  await saveUser(id, fullName);
  
  // Get user posts count
  const posts = await getUserPosts(id);
  const postCount = posts.length;
  
  // Generate auth token
  const authToken = await generateAuthToken(id);
  const loginUrl = `${BASE_URL}/auth/${authToken}`;
  
  // Send welcome message with inline keyboard
  await ctx.reply(
    `This is your current Shareme.bio account:\n\n${fullName}\n\nAuthor: ${fullName}\n\n${postCount} posts.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `Login as ${fullName}`, url: loginUrl }],
          [{ text: 'My posts', callback_data: 'my_posts' }],
          [{ text: 'Settings', callback_data: 'settings' }]
        ]
      }
    }
  );
});

// Handle "My posts" button click
bot.action('my_posts', async (ctx) => {
  try {
    // Answer the callback query to stop loading animation
    await ctx.answerCbQuery();
    
    const { id } = ctx.from;
    const fullName = getFullName(ctx.from);
    
    // Get user posts with details
    const posts = await getUserPostsWithDetails(id);
    
    if (posts.length === 0) {
      // Edit the message instead of sending a new one
      await ctx.editMessageText('You have no posts yet.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'my_posts' }],
            [{ text: '⬅️ Back to My Account', callback_data: 'my_account' }]
          ]
        }
      });
      return;
    }
    
    // Format post list with real view counts
    let message = `Posts by ${fullName}\n\n`;
    posts.forEach((post, index) => {
      const postUrl = `${BASE_URL}/${post.slug}`;
      message += `${index + 1}. ${post.title}\n`;
      message += `${post.views} view${post.views !== 1 ? 's' : ''} • ${postUrl}\n\n`;
    });
    
    // Edit the message instead of sending a new one
    await ctx.editMessageText(message, {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: 'my_posts_refresh' }],
          [{ text: '⬅️ Back to My Account', callback_data: 'my_account' }]
        ]
      }
    });
  } catch (error) {
    console.error('Error in my_posts action:', error);
    await ctx.reply('An error occurred while fetching your posts. Please try again.');
  }
});

// Handle "Refresh" button click in My Posts
bot.action('my_posts_refresh', async (ctx) => {
  // Just call the my_posts action again
  await ctx.answerCbQuery('Refreshing posts...');
  return ctx.callbackQuery.data = 'my_posts';
});

// Handle "My account" button click
bot.action('my_account', async (ctx) => {
  try {
    // Answer the callback query to stop loading animation
    await ctx.answerCbQuery();
    
    const { id } = ctx.from;
    const fullName = getFullName(ctx.from);
    
    // Get user posts count
    const posts = await getUserPosts(id);
    const postCount = posts.length;
    
    // Generate auth token
    const authToken = await generateAuthToken(id);
    const loginUrl = `${BASE_URL}/auth/${authToken}`;
    
    // Edit the message instead of sending a new one
    await ctx.editMessageText(
      `This is your current Shareme.bio account:\n${fullName}\nAuthor: ${fullName}\n${postCount} posts.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Login as ${fullName}`, url: loginUrl }],
            [{ text: 'My posts', callback_data: 'my_posts' }],
            [{ text: 'Settings', callback_data: 'settings' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in my_account action:', error);
    await ctx.reply('An error occurred. Please try again.');
  }
});

// Handle "Settings" button click
bot.action('settings', async (ctx) => {
  // Answer the callback query to stop loading animation
  await ctx.answerCbQuery();
  
  // Edit the message instead of sending a new one
  await ctx.editMessageText('Settings feature coming soon!', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⬅️ Back to My Account', callback_data: 'my_account' }]
      ]
    }
  });
});

// Start the bot
bot.launch().catch(err => console.error('Bot error:', err));

// Export functions for use in other files
export {
  bot,
  saveUser,
  getUser,
  addPostToUser,
  removePostFromUser,
  getUserPosts,
  generateAuthToken,
  verifyAuthToken
}; 