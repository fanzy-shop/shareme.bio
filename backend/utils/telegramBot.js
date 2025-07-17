import { Telegraf } from 'telegraf';
import { nanoid } from 'nanoid';
import redis from '../redis.js';
import { getPage, deletePage } from '../models/pageStore.js';

// Initialize bot with token
const bot = new Telegraf('7948218704:AAHJK8KD9BR7eBM5wUT-PMPrMK-PKUWOC9s');

// Redis keys
const USER_PREFIX = 'user:';
const USER_POSTS_PREFIX = 'user_posts:';
const AUTH_TOKEN_PREFIX = 'auth:';
const USER_SETTINGS_PREFIX = 'user_settings:';

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

// Get user settings
async function getUserSettings(telegramId) {
  const settings = await redis.hGetAll(USER_SETTINGS_PREFIX + telegramId);
  return Object.keys(settings).length ? settings : { authorName: '' };
}

// Save user settings
async function saveUserSettings(telegramId, settings) {
  await redis.hSet(USER_SETTINGS_PREFIX + telegramId, settings);
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
        createdAt: parseInt(page.createdAt),
        author: page.author,
        editToken: page.editToken // Include the edit token
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
  
  // Get user settings
  const settings = await getUserSettings(id);
  const authorName = settings.authorName || fullName;
  
  // Generate auth token
  const authToken = await generateAuthToken(id);
  const loginUrl = `${BASE_URL}/auth/${authToken}`;
  
  // Send welcome message with inline keyboard
  await ctx.reply(
    `This is your current Shareme.bio account:\n\n${fullName}\n\nAuthor: ${authorName}\n\n${postCount} posts.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `Login as ${authorName}`, url: loginUrl }],
          [{ text: '📝 My posts', callback_data: 'my_posts' }],
          [{ text: '⚙️ Settings', callback_data: 'settings' }],
          [{ text: '🆕 New post', url: `${BASE_URL}/new` }]
        ]
      }
    }
  );
});

// Handle "My posts" button click
bot.action('my_posts', async (ctx) => {
  try {
    const { id } = ctx.from;
    
    // Check if user is on cooldown (rate limiting)
    const lastRefresh = await redis.get(`refresh_cooldown_${id}`);
    const now = Date.now();
    
    if (lastRefresh && (now - parseInt(lastRefresh)) < 5000) {
      // Still on cooldown
      const remainingTime = Math.ceil((5000 - (now - parseInt(lastRefresh))) / 1000);
      await ctx.answerCbQuery(`Please wait ${remainingTime} seconds before refreshing again.`);
      return;
    }
    
    // Set cooldown
    await redis.set(`refresh_cooldown_${id}`, now, { EX: 10 }); // 10 seconds expiry
    
    // Answer the callback query to stop loading animation
    await ctx.answerCbQuery('Refreshing...');
    
    const fullName = getFullName(ctx.from);
    const settings = await getUserSettings(id);
    const authorName = settings.authorName || fullName;
    
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
    let message = `Posts by ${authorName}\n\n`;
    posts.forEach((post, index) => {
      const postUrl = `${BASE_URL}/${post.slug}`;
      const editUrl = `${BASE_URL}/edit/${post.slug}/${post.editToken || ''}`;
      message += `${index + 1}. ${post.title}\n`;
      message += `${post.views} view${post.views !== 1 ? 's' : ''} • ${postUrl}\n\n`;
    });
    
    // Create keyboard with post management options
    const keyboard = [];
    posts.forEach((post, index) => {
      keyboard.push([
        { text: `🗑️ Delete ${index + 1}`, callback_data: `delete_post_${post.slug}` },
        { text: `✏️ Edit ${index + 1}`, url: `${BASE_URL}/edit/${post.slug}/${post.editToken || ''}` }
      ]);
    });
    
    keyboard.push([
      { text: '🔄 Refresh', callback_data: 'my_posts' },
      { text: '⬅️ Back to My Account', callback_data: 'my_account' }
    ]);
    
    // Edit the message instead of sending a new one
    await ctx.editMessageText(message, {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } catch (error) {
    console.error('Error in my_posts action:', error);
    // Don't show error message to user, just log it
  }
});

// Handle delete post action
bot.action(/delete_post_(.+)/, async (ctx) => {
  try {
    const slug = ctx.match[1];
    const { id } = ctx.from;
    
    // Get post details
    const post = await getPage(slug);
    if (!post) {
      await ctx.answerCbQuery('Post not found!');
      return;
    }
    
    // Store deletion request
    await redis.set(`delete_confirm_${id}_${slug}`, 'pending', { EX: 300 }); // 5 minutes
    
    await ctx.answerCbQuery('Confirming deletion...');
    
    await ctx.editMessageText(
      `Are you sure you want to delete:\n\n"${post.title}"\n\nThis action cannot be undone!`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, delete it', callback_data: `confirm_delete_${slug}` },
              { text: '❌ Cancel', callback_data: 'my_posts' }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in delete_post action:', error);
    await ctx.answerCbQuery('Error occurred!');
  }
});

// Handle confirm delete action
bot.action(/confirm_delete_(.+)/, async (ctx) => {
  try {
    const slug = ctx.match[1];
    const { id } = ctx.from;
    
    // Verify deletion request
    const deleteRequest = await redis.get(`delete_confirm_${id}_${slug}`);
    if (!deleteRequest) {
      await ctx.answerCbQuery('Deletion request expired!');
      return;
    }
    
    // Delete the post
    await deletePage(slug);
    await removePostFromUser(id, slug);
    await redis.del(`delete_confirm_${id}_${slug}`);
    
    await ctx.answerCbQuery('Post deleted successfully!');
    
    // Go back to posts list
    ctx.callbackQuery.data = 'my_posts';
    await bot.handleAction(ctx);
    
  } catch (error) {
    console.error('Error in confirm_delete action:', error);
    await ctx.answerCbQuery('Error deleting post!');
  }
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
    
    // Get user settings
    const settings = await getUserSettings(id);
    const authorName = settings.authorName || fullName;
    
    // Generate auth token
    const authToken = await generateAuthToken(id);
    const loginUrl = `${BASE_URL}/auth/${authToken}`;
    
    // Edit the message instead of sending a new one
    await ctx.editMessageText(
      `This is your current Shareme.bio account:\n\n${fullName}\n\nAuthor: ${authorName}\n\n${postCount} posts.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `Login as ${authorName}`, url: loginUrl }],
            [{ text: '📝 My posts', callback_data: 'my_posts' }],
            [{ text: '⚙️ Settings', callback_data: 'settings' }],
            [{ text: '🆕 New post', url: `${BASE_URL}/new` }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in my_account action:', error);
    // Don't show error message to user, just log it
  }
});

// Handle "Settings" button click
bot.action('settings', async (ctx) => {
  try {
    // Answer the callback query to stop loading animation
    await ctx.answerCbQuery();
    
    const { id } = ctx.from;
    const settings = await getUserSettings(id);
    const authorName = settings.authorName || getFullName(ctx.from);
    
    // Edit the message instead of sending a new one
    await ctx.editMessageText(
      `⚙️ Settings\n\nCurrent author name: ${authorName}\n\nWhat would you like to change?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✏️ Change author name', callback_data: 'change_author_name' }],
            [{ text: '📊 View statistics', callback_data: 'view_stats' }],
            [{ text: '🔄 Refresh all data', callback_data: 'refresh_all' }],
            [{ text: '⬅️ Back to My Account', callback_data: 'my_account' }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error in settings action:', error);
    // Don't show error message to user, just log it
  }
});

// Handle "Change author name" action
bot.action('change_author_name', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const { id } = ctx.from;
    const settings = await getUserSettings(id);
    const currentName = settings.authorName || getFullName(ctx.from);
    
    await ctx.editMessageText(
      `✏️ Change Author Name\n\nCurrent: ${currentName}\n\nTo change your author name, please send me a message with your new name.\n\nOr click the button below to use your Telegram name.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Use Telegram name', callback_data: 'use_telegram_name' }],
            [{ text: '⬅️ Back to Settings', callback_data: 'settings' }]
          ]
        }
      }
    );
    
    // Set user state to expect author name
    await redis.set(`user_state_${id}`, 'waiting_for_author_name', { EX: 300 });
    
  } catch (error) {
    console.error('Error in change_author_name action:', error);
    // Don't show error message to user, just log it
  }
});

// Handle "Use Telegram name" action
bot.action('use_telegram_name', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const { id } = ctx.from;
    const telegramName = getFullName(ctx.from);
    
    // Save the new author name
    await saveUserSettings(id, { authorName: telegramName });
    await redis.del(`user_state_${id}`);
    
    await ctx.editMessageText(
      `✅ Author name updated!\n\nNew author name: ${telegramName}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back to Settings', callback_data: 'settings' }]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in use_telegram_name action:', error);
    // Don't show error message to user, just log it
  }
});

// Handle "View statistics" action
bot.action('view_stats', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const { id } = ctx.from;
    const posts = await getUserPostsWithDetails(id);
    
    const totalViews = posts.reduce((sum, post) => sum + post.views, 0);
    const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;
    const mostViewed = posts.length > 0 ? posts.reduce((max, post) => post.views > max.views ? post : max) : null;
    
    let statsMessage = `📊 Your Statistics\n\n`;
    statsMessage += `📝 Total posts: ${posts.length}\n`;
    statsMessage += `👁️ Total views: ${totalViews}\n`;
    statsMessage += `📈 Average views: ${avgViews}\n`;
    
    if (mostViewed) {
      statsMessage += `🔥 Most viewed: "${mostViewed.title}" (${mostViewed.views} views)\n`;
    }
    
    await ctx.editMessageText(statsMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh stats', callback_data: 'view_stats' }],
          [{ text: '⬅️ Back to Settings', callback_data: 'settings' }]
        ]
      }
    });
    
  } catch (error) {
    console.error('Error in view_stats action:', error);
    // Don't show error message to user, just log it
  }
});

// Handle "Refresh all data" action
bot.action('refresh_all', async (ctx) => {
  try {
    await ctx.answerCbQuery('Refreshing all data...');
    
    const { id } = ctx.from;
    
    // Refresh user posts and settings
    const posts = await getUserPostsWithDetails(id);
    const settings = await getUserSettings(id);
    
    await ctx.editMessageText(
      `🔄 Data refreshed!\n\n📝 Posts: ${posts.length}\n⚙️ Settings: Updated\n\nAll data has been refreshed from the server.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back to Settings', callback_data: 'settings' }]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error('Error in refresh_all action:', error);
    // Don't show error message to user, just log it
  }
});

// Handle text messages for author name change
bot.on('text', async (ctx) => {
  try {
    const { id } = ctx.from;
    const userState = await redis.get(`user_state_${id}`);
    
    if (userState === 'waiting_for_author_name') {
      const newAuthorName = ctx.message.text.trim();
      
      if (newAuthorName.length < 2) {
        await ctx.reply('Author name must be at least 2 characters long. Please try again.');
        return;
      }
      
      if (newAuthorName.length > 50) {
        await ctx.reply('Author name must be less than 50 characters. Please try again.');
        return;
      }
      
      // Save the new author name
      await saveUserSettings(id, { authorName: newAuthorName });
      await redis.del(`user_state_${id}`);
      
      await ctx.reply(
        `✅ Author name updated!\n\nNew author name: ${newAuthorName}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Back to Settings', callback_data: 'settings' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error handling text message:', error);
  }
});

// Start the bot
bot.launch().catch(err => console.error('Bot error:', err));

// Export functions for use in other files
export {
  bot,
  saveUser,
  getUser,
  getUserSettings,
  saveUserSettings,
  addPostToUser,
  removePostFromUser,
  getUserPosts,
  generateAuthToken,
  verifyAuthToken
}; 