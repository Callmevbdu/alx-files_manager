import { createClient } from 'redis';
import { promisify } from 'util';

/**
 * A Redis Client
 */
class RedisClient {
  /**
   * The class RedisClient. RedisClient should have:
   * - The constructor that creates a client to Redis:
   * 	+ any error of the redis client must be displayed in the console (you
   * 	should use on('error') of the redis client).
   */
  constructor() {
    this.client = createClient();
    this.isClientConnected = true;
    this.client.on('error', (error) => {
      console.error('Redis client failed to connect:', error.message || error.toString());
      this.isClientConnected = false;
    });
    this.client.on('connect', () => {
      this.isClientConnected = true;
    });
  }

  /**
   * a function isAlive that returns true when the connection to Redis is a
   * success otherwise, false.
   * @returns {boolean}
   */
  isAlive() {
    return this.isClientConnected;
  }

  /**
   * An asynchronous function get that takes a string key as argument and
   * returns the Redis value stored for this key.
   * @param {String} key - Item key to retrieve.
   * @returns {String | Object}
   */
  async get(key) {
    return promisify(this.client.GET).bind(this.client)(key);
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
    await promisify(this.client.SETEX)
      .bind(this.client)(key, durationInSec, value);
  }

  /**
   * An asynchronous function del that takes a string key as argument and
   * remove the value in Redis for this key.
   * @param {String} key - Item key to remove.
   * @returns {Promise<void>}
   */
  async del(key) {
    await promisify(this.client.DEL).bind(this.client)(key);
  }
}

export const redisClient = new RedisClient();
export default redisClient;
