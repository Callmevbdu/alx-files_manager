import mongodb from 'mongodb';
import Collection from 'mongodb/lib/collection';

/**
 * The class DBClient.
 */
class DBClient {
  /**
   * The constructor that creates a client to MongoDB:
   * 	- host: from the environment variable DB_HOST or default: localhost
   * 	- port: from the environment variable DB_PORT or default: 27017
   * 	- database: from the environment variable DB_DATABASE or default:
   * 	files_manager
   */
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const dbLink = `mongodb://${host}:${port}/${database}`;

    this.client = new mongodb.MongoClient(dbLink, { useUnifiedTopology: true });
    this.client.connect();
  }

  /**
   * A function isAlive that returns true when the connection to MongoDB is a
   * success otherwise, false.
   * @returns {boolean}
   */
  isAlive() {
    return this.client.isConnected();
  }

  /**
   * An asynchronous function nbUsers that returns the number of documents in
   * the collection users.
   * @returns {Promise<Number>}
   */
  async nbUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  /**
   * An asynchronous function nbFiles that returns the number of documents in
   * the collection files.
   * @returns {Promise<Number>}
   */
  async nbFiles() {
    return this.client.db().collection('files').countDocuments();
  }

  /**
   * Retrieves a reference to the `users` collection.
   * @returns {Promise<Collection>}
   */
  async usersCollection() {
    return this.client.db().collection('users');
  }

  /**
   * Retrieves a reference to the `files` collection.
   * @returns {Promise<Collection>}
   */
  async filesCollection() {
    return this.client.db().collection('files');
  }
}

export const dbClient = new DBClient();
export default dbClient;
