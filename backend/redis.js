import { createClient } from 'redis';

// Use environment variable for Redis URL if available
const redisUrl = process.env.REDIS_URL || 'redis://default:AnraPrxbErJfsNCVZZVNHqNSYdXeqwUa@tramway.proxy.rlwy.net:32809';

console.log('Using Redis URL:', redisUrl.replace(/\/\/.*?@/, '//***@')); // Log URL with password hidden

const client = createClient({
  url: redisUrl
});

client.on('error', err => console.error('Redis error', err));

// Connect to Redis
try {
  await client.connect();
  console.log('Connected to Redis');
} catch (err) {
  console.error('Failed to connect to Redis:', err);
  // Don't throw error, let the app continue without Redis
}

export default client; 