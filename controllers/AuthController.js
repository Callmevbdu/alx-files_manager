import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import DBClient from '../utils/db';
import RedisClient from '../utils/redis';

class AuthController {
  /**
   * GET /connect should sign-in the user by generating a new authentication
   * token:
   * - By using the header Authorization and the technique of the Basic auth
   * (Base64 of the <email>:<password>), find the user associate to this
   * email and with this password (reminder: we are storing the SHA1 of the
   * password)
   * - If no user has been found, return an error Unauthorized with a status
   * code 401
   * - Otherwise:
   * + Generate a random string (using uuidv4) as token
   * + Create a key: auth_<token>
   * + Use this key for storing in Redis (by using the redisClient
   * create previously) the user ID for 24 hours00
   * + Return this token: { "token": "155342df-2399-41da-9e8c-458b6ac52a0c" }
   * with a status code 200
   */
  static async getConnect(req, res) {
    const authorization = req.header('Authorization') || null;
    if (!authorization) return res.status(401).send({ error: 'Unauthorized' });

    const buff = Buffer.from(authorization.replace('Basic ', ''), 'base64');
    const credentials = {
      email: buff.toString('utf-8').split(':')[0],
      password: buff.toString('utf-8').split(':')[1],
    };

    if (!credentials.email || !credentials.password) return res.status(401).send({ error: 'Unauthorized' });

    credentials.password = sha1(credentials.password);

    const userExists = await DBClient.db
      .collection('users')
      .findOne(credentials);
    if (!userExists) return res.status(401).send({ error: 'Unauthorized' });

    const token = uuidv4();
    const key = `auth_${token}`;
    await RedisClient.set(key, userExists._id.toString(), 86400);

    return res.status(200).send({ token });
  }

  /**
   * GET /disconnect should sign-out the user based on the token:
   * - Retrieve the user based on the token:
   * + If not found, return an error Unauthorized with a status code 401
   * + Otherwise, delete the token in Redis and return nothing with a status
   * code 204
   */
  static async getDisconnect(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    await RedisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}

module.exports = AuthController;
