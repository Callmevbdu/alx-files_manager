const { MongoClient } = require('mongodb');

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${host}:${port}`;
//
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
    MongoClient.connect(url, (err, client) => {
      if (!err) {
        this.db = client.db(database);
      } else {
        this.db = false;
      }
    });
  }

  /**
   * A function isAlive that returns true when the connection to MongoDB is a
   * success otherwise, false.
   * @returns {boolean}
   */
  isAlive() {
    if (this.db) return true;
    return false;
  }

  /**
   * An asynchronous function nbUsers that returns the number of documents in
   * the collection users.
   * @returns {Promise<Number>}
   */
  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  /**
   * An asynchronous function nbFiles that returns the number of documents in
   * the collection files.
   * @returns {Promise<Number>}
   */
  async nbFiles() {
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
