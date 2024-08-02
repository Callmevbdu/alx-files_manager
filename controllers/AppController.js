import RedisClient from '../utils/redis';
import DBClient from '../utils/db';

/**
 * a file AppController.js that contains the definition of the 2 endpoints:
 * 	- GET /status should return if Redis is alive and if the DB is alive
 * 	too by using the 2 utils created previously:
 * 	{ "redis": true, "db": true } with a status code 200
 * 	- GET /stats should return the number of users and files in DB:
 * 	{ "users": 12, "files": 1231 } with a status code 200
 * 		+ users collection must be used for counting all users
 * 		+ files collection must be used for counting all files
 */
class AppController {
  static getStatus(req, res) {
    const data = {
      redis: RedisClient.isAlive(),
      db: DBClient.isAlive(),
    };
    return res.status(200).send(data);
  }

  static async getStats(req, res) {
    const data = {
      users: await DBClient.nbUsers(),
      files: await DBClient.nbFiles(),
    };
    return res.status(200).send(data);
  }
}

module.exports = AppController;
