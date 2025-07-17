import { Telegraf } from 'telegraf';
import { nanoid } from 'nanoid';
import redis from '../redis.js';
import { getPage, deletePage, getRecent } from '../models/pageStore.js';

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

// Search posts by title or author name
async function searchPosts(query) {
  // Get recent pages to search through
  const recentPages = await getRecent(100);
  
  if (!query || query.trim() === '') {
    return recentPages.slice(0, 10);
  }
  
  // Normalize query for case-insensitive search
  const normalizedQuery = query.toLowerCase().trim();
  
  // Filter pages by title or author containing the query
  const matchingPages = recentPages.filter(page => {
    const title = (page.title || '').toLowerCase();
    const author = (page.author || '').toLowerCase();
    return title.includes(normalizedQuery) || author.includes(normalizedQuery);
  });
  
  return matchingPages.slice(0, 10); // Return at most 10 results
}

// Find user by name or username
async function findUserByName(nameQuery) {
  if (!nameQuery || nameQuery.trim() === '') return [];
  
  const normalizedQuery = nameQuery.toLowerCase().trim();
  const allUserKeys = await redis.keys(USER_PREFIX + '*');
  
  const users = await Promise.all(
    allUserKeys.map(async (key) => {
      const userData = await redis.hGetAll(key);
      const telegramId = key.replace(USER_PREFIX, '');
      const settings = await getUserSettings(telegramId);
      
      return {
        telegramId,
        name: userData.name || '',
        authorName: settings.authorName || userData.name || ''
      };
    })
  );
  
  // Filter users by name matching the query
  const matchingUsers = users.filter(user => {
    return (
      user.name.toLowerCase().includes(normalizedQuery) ||
      user.authorName.toLowerCase().includes(normalizedQuery)
    );
  });
  
  return matchingUsers.slice(0, 5); // Return at most 5 results
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

// Help command that explains bot features
bot.command('help', async (ctx) => {
  await ctx.reply(
    `ShareMe.bio Bot Help:\n\n` +
    `💬 <b>Commands</b>\n` +
    `/start - Manage your account and posts\n` +
    `/help - Show this help message\n\n` +
    
    `📱 <b>Inline Mode</b>\n` +
    `Use @sharemebio_bot in any chat to:\n\n` +
    
    `🔍 <b>Search posts</b>:\n` +
    `@sharemebio_bot search term\n\n` +
    
    `👤 <b>Find user posts</b>:\n` +
    `@sharemebio_bot @username\n\n` +
    
    `🌐 <b>Website</b>: ${BASE_URL}`,
    { parse_mode: 'HTML' }
  );
});

// Set commands for the bot menu in Telegram
bot.telegram.setMyCommands([
  { command: 'start', description: 'Start the bot and manage your account' },
  { command: 'help', description: 'Show help for all features including inline mode' }
]).catch(err => console.error('Error setting commands:', err));

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
    
    // Show success message with back button
    await ctx.editMessageText(
      `✅ Post deleted successfully!\n\nThe post has been permanently removed from your account.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back to My Posts', callback_data: 'my_posts' }],
            [{ text: '🏠 Back to My Account', callback_data: 'my_account' }]
          ]
        }
      }
    );
    
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
    
    // Update website session if user is logged in
    const user = await getUser(id);
    if (user) {
      // Store updated user info in session for website sync
      await redis.set(`session_user_${id}`, JSON.stringify({
        telegramId: id,
        name: user.name,
        authorName: telegramName
      }), { EX: 86400 }); // 24 hours
    }
    
    await ctx.editMessageText(
      `✅ Author name updated!\n\nNew author name: ${telegramName}\n\nThis change will be reflected on the website when you log in.`,
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
      
      // Update website session if user is logged in
      const user = await getUser(id);
      if (user) {
        // Store updated user info in session for website sync
        await redis.set(`session_user_${id}`, JSON.stringify({
          telegramId: id,
          name: user.name,
          authorName: newAuthorName
        }), { EX: 86400 }); // 24 hours
      }
      
      await ctx.reply(
        `✅ Author name updated!\n\nNew author name: ${newAuthorName}\n\nThis change will be reflected on the website when you log in.`,
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

// Handle inline queries for searching posts
bot.on('inline_query', async (ctx) => {
  try {
    const { query } = ctx.inlineQuery;
    const offset = parseInt(ctx.inlineQuery.offset) || 0;
    
    // Check if we're looking for user's posts (format: @username)
    if (query.startsWith('@')) {
      const username = query.slice(1).toLowerCase(); // Remove @ and lowercase
      
      // Find matching users
      const users = await findUserByName(username);
      
      if (users.length === 0) {
        await ctx.answerInlineQuery([{
          type: 'article',
          id: 'no-user-found',
          title: 'No user found',
          description: `No user found with username "${username}"`,
          input_message_content: {
            message_text: `Could not find user "${username}" on shareme.bio`
          }
        }]);
        return;
      }
      
      // Get posts for each user
      const results = [];
      
      for (const user of users) {
        const userPosts = await getUserPostsWithDetails(user.telegramId);
        
        if (userPosts.length === 0) {
          // Add a "no posts" result if user has no posts
          results.push({
            type: 'article',
            id: `no-posts-${user.telegramId}`,
            title: `${user.authorName} (no posts)`,
            description: 'This user has no posts.',
            input_message_content: {
              message_text: `${user.authorName} has no posts on shareme.bio`
            }
          });
          continue;
        }
        
        // Add posts from this user
        userPosts.forEach(post => {
          const postUrl = `${BASE_URL}/${post.slug}`;
          
          results.push({
            type: 'article',
            id: post.slug,
            title: post.title,
            description: `${post.views} views • By ${user.authorName}`,
            url: postUrl,
            input_message_content: {
              message_text: `Check out "${post.title}" by ${user.authorName}\n${postUrl}`,
              disable_web_page_preview: false
            },
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔗 Open Post', url: postUrl }]
              ]
            }
          });
        });
      }
      
      await ctx.answerInlineQuery(results, {
        cache_time: 30, // Cache results for 30 seconds
        next_offset: results.length === 0 ? '' : (offset + results.length).toString()
      });
      return;
    }
    
    // Regular search (title/content based)
    const searchResults = await searchPosts(query);
    
    if (searchResults.length === 0) {
      await ctx.answerInlineQuery([{
        type: 'article',
        id: 'no-results',
        title: 'No results found',
        description: query ? `No results found for "${query}"` : 'Search for posts...',
        input_message_content: {
          message_text: query ? `No results found for "${query}" on shareme.bio` : 'Try searching for posts on shareme.bio'
        }
      }]);
      return;
    }
    
    // Format results for inline query
    const results = searchResults.map(post => {
      const postUrl = `${BASE_URL}/${post.slug}`;
      
      return {
        type: 'article',
        id: post.slug,
        title: post.title,
        description: `${post.views} views • By ${post.author}`,
        url: postUrl,
        input_message_content: {
          message_text: `Check out "${post.title}" by ${post.author}\n${postUrl}`,
          disable_web_page_preview: false
        },
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔗 Open Post', url: postUrl }]
          ]
        }
      };
    });
    
    await ctx.answerInlineQuery(results, {
      cache_time: 30, // Cache results for 30 seconds
      next_offset: results.length === 0 ? '' : (offset + results.length).toString()
    });
    
  } catch (error) {
    console.error('Error handling inline query:', error);
    
    // Return a generic error result
    await ctx.answerInlineQuery([{
      type: 'article',
      id: 'error',
      title: 'Error occurred',
      description: 'An error occurred while searching.',
      input_message_content: {
        message_text: 'Sorry, an error occurred while searching. Please try again later.'
      }
    }]);
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