import redis from 'redis';

class RedisClient {
  constructor() {
    this.client = redis.createClient();

    // Display any errors in the console
    this.client.on('error', (error) => {
      console.error('Redis error:', error);
    });
  }

  async isAlive() {
    return new Promise((resolve) => {
      this.client.ping('alive', (err, reply) => {
        if (err) {
          resolve(false);
        } else {
          resolve(reply === 'alive');
        }
      });
    });
  }

  async get(key) {
    return new Promise((resolve) => {
      this.client.get(key, (err, value) => {
        if (err) {
          resolve(null);
        } else {
          resolve(value);
        }
      });
    });
  }

  async set(key, value, durationInSeconds) {
    this.client.setex(key, durationInSeconds, value);
  }

  async del(key) {
    this.client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
