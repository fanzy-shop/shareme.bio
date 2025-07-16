import { createClient } from 'redis';

// Use environment variable for Redis URL if available
const redisUrl = process.env.REDIS_URL || 'redis://default:AnraPrxbErJfsNCVZZVNHqNSYdXeqwUa@tramway.proxy.rlwy.net:32809';

console.log('Using Redis URL:', redisUrl.replace(/\/\/.*?@/, '//***@')); // Log URL with password hidden

const client = createClient({
  url: redisUrl
});

client.on('error', err => console.error('Redis error', err));

// Initialize connection
let isConnected = false;

async function connect() {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log('Connected to Redis');
    } catch (err) {
      console.error('Failed to connect to Redis:', err);
      throw err;
    }
  }
  return client;
}

// Auto-connect on first use
const redisClient = new Proxy(client, {
  get(target, prop) {
    if (!isConnected && typeof target[prop] === 'function') {
      return async function(...args) {
        await connect();
        return target[prop].apply(target, args);
      };
    }
    return target[prop];
  }
});

export default redisClient; 