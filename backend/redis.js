import { createClient } from 'redis';

const client = createClient({
  url: 'redis://default:AJFZvlgmJBkEFBEYrjimvnVUvkvWlkFB@switchback.proxy.rlwy.net:14760'
});

client.on('error', err => console.error('Redis error', err));

try {
  await client.connect();
  console.log('Connected to Redis');
} catch (err) {
  console.error('Failed to connect to Redis:', err);
}

export default client; 