import sha1 from 'sha1';
import DBClient from '../utils/db';
import RedisClient from '../utils/redis';

const { ObjectId } = require('mongodb');

class UsersController {
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
   * create previously) the user ID for 24 hours
   * + Return this token: { "token": "155342df-2399-41da-9e8c-458b6ac52a0c" }
   * with a status code 200
   */
  static async postNew(request, response) {
    const userEmail = request.body.email;
    if (!userEmail) return response.status(400).send({ error: 'Missing email' });

    const userPassword = request.body.password;
    if (!userPassword) return response.status(400).send({ error: 'Missing password' });

    const oldUserEmail = await DBClient.db
      .collection('users')
      .findOne({ email: userEmail });
    if (oldUserEmail) return response.status(400).send({ error: 'Already exist' });

    const shaUserPassword = sha1(userPassword);
    const result = await DBClient.db
      .collection('users')
      .insertOne({ email: userEmail, password: shaUserPassword });

    return response
      .status(201)
      .send({ id: result.insertedId, email: userEmail });
  }

  /**
   * GET /users/me should retrieve the user base on the token used:
   * - Retrieve the user based on the token:
   * + If not found, return an error Unauthorized with a status code 401
   * + Otherwise, return the user object (email and id only)
   */
  static async getMe(request, response) {
    const token = request.header('X-Token') || null;
    if (!token) return response.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return response.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db
      .collection('users')
      .findOne({ _id: ObjectId(redisToken) });
    if (!user) return response.status(401).send({ error: 'Unauthorized' });
    delete user.password;

    return response.status(200).send({ id: user._id, email: user.email });
  }
}

module.exports = UsersController;
