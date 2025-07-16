import redis from '../redis.js';

const PAGE_PREFIX = 'page:';    // hash key per page
const LIST_KEY    = 'pages:list'; // list of slugs (LPUSH order = newest first)

// Helper function to check if Redis is connected
async function isRedisConnected() {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis not connected:', error);
    return false;
  }
}

export async function savePage({ slug, title, content, author, createdAt, editToken, views = 0, telegramId = null }) {
  if (!(await isRedisConnected())) {
    throw new Error('Redis not available');
  }
  
  const pageData = {
    title,
    content,
    author: author || '',
    createdAt,
    editToken,
    views: views.toString()
  };
  
  // Add telegramId if provided
  if (telegramId) {
    pageData.telegramId = telegramId;
  }
  
  await redis.hSet(PAGE_PREFIX + slug, pageData);
  await redis.lRem(LIST_KEY, 0, slug); // ensure uniqueness
  await redis.lPush(LIST_KEY, slug);
}

export async function getPage(slug) {
  if (!(await isRedisConnected())) {
    return null;
  }
  
  const data = await redis.hGetAll(PAGE_PREFIX + slug);
  if (Object.keys(data).length === 0) return null;
  
  // Include the slug in the page data
  return { ...data, slug };
}

export async function updatePage(slug, { title, content, author, views }) {
  if (!(await isRedisConnected())) {
    throw new Error('Redis not available');
  }
  
  const updateData = {};
  
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (author !== undefined) updateData.author = author;
  if (views !== undefined) updateData.views = views.toString();
  
  if (Object.keys(updateData).length > 0) {
    await redis.hSet(PAGE_PREFIX + slug, updateData);
  }
}

export async function deletePage(slug) {
  if (!(await isRedisConnected())) {
    throw new Error('Redis not available');
  }
  
  // Delete page data from Redis
  await redis.del(PAGE_PREFIX + slug);
  
  // Remove slug from the list of pages
  await redis.lRem(LIST_KEY, 0, slug);
  
  return true;
}

export async function incrementViews(slug) {
  if (!(await isRedisConnected())) {
    return; // Silently fail for view increments
  }
  
  await redis.hIncrBy(PAGE_PREFIX + slug, 'views', 1);
}

export async function getRecent(limit = 50) {
  if (!(await isRedisConnected())) {
    return []; // Return empty array if Redis not available
  }
  
  const slugs = await redis.lRange(LIST_KEY, 0, limit - 1);
  const pages = await Promise.all(slugs.map(getPage));
  return pages.filter(Boolean);
}

export async function getPagesByTelegramId(telegramId, limit = 50) {
  if (!(await isRedisConnected())) {
    return []; // Return empty array if Redis not available
  }
  
  // This would need to be implemented differently for efficiency in a real app
  // For example, using a separate index or a user_posts set
  const allPages = await getRecent(1000); // Get a large number of recent pages
  return allPages
    .filter(page => page.telegramId === telegramId)
    .slice(0, limit);
} 