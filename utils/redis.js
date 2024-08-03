const redis = require('redis');
const { promisify } = require('util');

/**
 * A Redis Client
 */
class RedisClient {
  /**
   * The class RedisClient. RedisClient should have:
   * - The constructor that creates a client to Redis:
   * - any error of the redis client must be displayed in the console (you
   * 	should use on('error') of the redis client).
   */
  constructor() {
    this.client = redis.createClient();
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.client.on('error', (error) => {
      console.error(`Redis client not connected to the server: ${error}`);
    });
  }

  /**
   * a function isAlive that returns true when the connection to Redis is a
   * success otherwise, false.
   * @returns {boolean}
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * An asynchronous function get that takes a string key as argument and
   * returns the Redis value stored for this key.
   * @param {String} key - Item key to retrieve.
   * @returns {String | Object}
   */
  async get(key) {
    const value = await this.getAsync(key);
    return value;
  }

  /**
   * An asynchronous function set that takes a string key, a value and a
   * duration in second as arguments to store it in Redis (with an expiration
   * set by the duration argument).
   * @param {String} key - Item key to store.
   * @param {String | Number | Boolean} value - Item value to store.
   * @param {Number} duration - Expiration time in seconds.
   * @returns {Promise<void>}
   */
  async set(key, value, durationInSec) {
    this.client.set(key, value);
    this.client.expire(key, durationInSec);
  }

  /**
   * An asynchronous function del that takes a string key as argument and
   * remove the value in Redis for this key.
   * @param {String} key - Item key to remove.
   * @returns {Promise<void>}
   */
  async del(key) {
    this.client.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;a