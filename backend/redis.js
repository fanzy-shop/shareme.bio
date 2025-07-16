import { createClient } from 'redis';

const client = createClient({
  url: 'redis://default:AnraPrxbErJfsNCVZZVNHqNSYdXeqwUa@redis.railway.internal:6379'
});

client.on('error', err => console.error('Redis error', err));

try {
  await client.connect();
  console.log('Connected to Redis');
} catch (err) {
  console.error('Failed to connect to Redis:', err);
}

export default client; 