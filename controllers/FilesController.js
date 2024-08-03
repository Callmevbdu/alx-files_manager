import { v4 as uuidv4 } from 'uuid';
import mongoDBCore from 'mongodb/lib/core';
import RedisClient from '../utils/redis';
import DBClient from '../utils/db';

const { ObjectId } = require('mongodb');
const fs = require('fs');
const mime = require('mime-types');
const Bull = require('bull');

const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');
const ROOT_FOLDER_ID = 0;
const MAX_FILES_PER_PAGE = 20;

const isValidId = (id) => {
  const size = 24;
  let i = 0;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  while (i < size) {
    const c = id[i];
    const code = c.charCodeAt(0);

    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
    i += 1;
  }
  return true;
};

/**
 * A file FilesController.js that contains endpoints:
 */
export default class FilesController {
  /**
   * POST /files should create a new file in DB and in disk:
   * - Retrieve the user based on the token:
   * + If not found, return an error Unauthorized with a status code 401
   * - To create a file, you must specify:
   * + name: as filename
   * + type: either folder, file or image
   * + parentId: (optional) as ID of the parent (default: 0 -> the root)
   * + isPublic: (optional) as boolean to define if the file is public or not (default: false)
   * + data: (only for type=file|image) as Base64 of the file content
   * - If the name is missing, return an error Missing name with a status code 400
   * - If the type is missing or not part of the list of accepted type, return an error Missing
   * type with a status code 400
   * - If the data is missing and type != folder, return an error Missing data with a status code
   * 400
   * - If the parentId is set:
   * + If no file is present in DB for this parentId, return an error Parent not found with
   * a status code 400
   * + If the file present in DB for this parentId is not of type folder, return an error Parent is
   * not a folder with a status code 400
   * - The user ID should be added to the document saved in DB - as owner of a file
   * - If the type is folder, add the new file document in the DB and return the new file with a
   * status code 201
   * - Otherwise:
   * + All file will be stored locally in a folder (to create automatically if not present):
   * * The relative path of this folder is given by the environment variable FOLDER_PATH
   * * If this variable is not present or empty, use /tmp/files_manager as storing folder path
   * + Create a local path in the storing folder with filename a UUID
   * + Store the file in clear (reminder: data contains the Base64 of the file) in this local path
   * + Add the new file document in the collection files with these attributes:
   * * userId: ID of the owner document (owner from the authentication)
   * * name: same as the value received
   * * type: same as the value received
   * * isPublic: same as the value received
   * * parentId: same as the value received - if not present: 0
   * * localPath: for a type=file|image, the absolute path to the file save in local
   * + Return the new file with a status code 201
   * @param {Request} req - Express request object.
   * @param {Response} res - Express response object.
   */
  static async postUpload(req, res) {
    const fileQueue = new Bull('fileQueue');

    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db
      .collection('users')
      .findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const fileName = req.body.name;
    if (!fileName) return res.status(400).send({ error: 'Missing name' });

    const fileType = req.body.type;
    if (!fileType || !['folder', 'file', 'image'].includes(fileType)) return res.status(400).send({ error: 'Missing type' });

    const fileData = req.body.data;
    if (!fileData && ['file', 'image'].includes(fileType)) return res.status(400).send({ error: 'Missing data' });

    const fileIsPublic = req.body.isPublic || false;
    let idParent = req.body.parentId || 0;
    idParent = idParent === '0' ? 0 : idParent;
    if (idParent !== 0) {
      const parentFile = await DBClient.db
        .collection('files')
        .findOne({ _id: ObjectId(idParent) });
      if (!parentFile) return res.status(400).send({ error: 'Parent not found' });
      if (!['folder'].includes(parentFile.type)) return res.status(400).send({ error: 'Parent is not a folder' });
    }

    const dbFile = {
      userId: user._id,
      name: fileName,
      type: fileType,
      isPublic: fileIsPublic,
      parentId: idParent,
    };

    if (['folder'].includes(fileType)) {
      await DBClient.db.collection('files').insertOne(dbFile);
      return res.status(201).send({
        id: dbFile._id,
        userId: dbFile.userId,
        name: dbFile.name,
        type: dbFile.type,
        isPublic: dbFile.isPublic,
        parentId: dbFile.parentId,
      });
    }

    const pathDir = process.env.FOLDER_PATH || '/tmp/files_manager';
    const uuidFile = uuidv4();

    const buff = Buffer.from(fileData, 'base64');
    const pathFile = `${pathDir}/${uuidFile}`;

    await fs.mkdir(pathDir, { recursive: true }, (error) => {
      if (error) return res.status(400).send({ error: error.message });
      return true;
    });

    await fs.writeFile(pathFile, buff, (error) => {
      if (error) return res.status(400).send({ error: error.message });
      return true;
    });

    dbFile.localPath = pathFile;
    await DBClient.db.collection('files').insertOne(dbFile);

    fileQueue.add({
      userId: dbFile.userId,
      fileId: dbFile._id,
    });

    return res.status(201).send({
      id: dbFile._id,
      userId: dbFile.userId,
      name: dbFile.name,
      type: dbFile.type,
      isPublic: dbFile.isPublic,
      parentId: dbFile.parentId,
    });
  }

  /**
   * GET /files/:id should retrieve the file document based on the ID:
   * - Retrieve the user based on the token:
   * + If not found, return an error Unauthorized with a status code 401
   * - If no file document is linked to the user and the ID passed as parameter,
   * return an error Not found with a status code 404
   * - Otherwise, return the file document
   * @param {Request} req - Express request object.
   * @param {Response} res - Express response object.
   */
  static async getShow(req, res) {
    const { user } = req;
    const id = req.params ? req.params.id : NULL_ID;
    const userId = user._id.toString();
    const file = await (await DBClient.filesCollection())
      .findOne({
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : NULL_ID),
      });

    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === ROOT_FOLDER_ID.toString()
        ? 0
        : file.parentId.toString(),
    });
  }

  /**
   * GET /files should retrieve all users file documents for a specific parentId and with
   * pagination:
   * - Retrieve the user based on the token:
   * + If not found, return an error Unauthorized with a status code 401
   * - Based on the query parameters parentId and page, return the list of file document
   * + parentId:
   * * No validation of parentId needed - if the parentId is not linked to any user folder, returns
   * an empty list
   * * By default, parentId is equal to 0 = the root
   * + Pagination:
   * * Each page should be 20 items max
   * * page query parameter starts at 0 for the first page. If equals to 1, it means it’s the
   * second page (form the 20th to the 40th), etc…
   * * Pagination can be done directly by the aggregate of MongoDB
   * @param {Request} req - Express request object.
   * @param {Response} res - Express response object.
   */
  static async getIndex(req, res) {
    const { user } = req;
    const parentId = req.query.parentId || ROOT_FOLDER_ID.toString();
    const page = /\d+/.test((req.query.page || '').toString())
      ? Number.parseInt(req.query.page, 10)
      : 0;
    const filesFilter = {
      userId: user._id,
      parentId: parentId === ROOT_FOLDER_ID.toString()
        ? parentId
        : new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : NULL_ID),
    };

    const files = await (await (await DBClient.filesCollection())
      .aggregate([
        { $match: filesFilter },
        { $sort: { _id: -1 } },
        { $skip: page * MAX_FILES_PER_PAGE },
        { $limit: MAX_FILES_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: {
              $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
            },
          },
        },
      ])).toArray();
    res.status(200).json(files);
  }

  /**
   * PUT /files/:id/publish should set isPublic to true on the file document based on the ID:
   * - Retrieve the user based on the token:
   * + If not found, return an error Unauthorized with a status code 401
   * - If no file document is linked to the user and the ID passed as parameter,
   * return an error Not found with a status code 404
   * - Otherwise:
   * + Update the value of isPublic to true
   * + And return the file document with a status code 200
   * @param {Request} req - Express request object.
   * @param {Response} res - Express response object.
   */
  static async putPublish(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db
      .collection('users')
      .findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const idFile = req.params.id || '';

    let fileDocument = await DBClient.db
      .collection('files')
      .findOne({ _id: ObjectId(idFile), userId: user._id });
    if (!fileDocument) return res.status(404).send({ error: 'Not found' });

    await DBClient.db
      .collection('files')
      .update({ _id: ObjectId(idFile) }, { $set: { isPublic: true } });
    fileDocument = await DBClient.db
      .collection('files')
      .findOne({ _id: ObjectId(idFile), userId: user._id });

    return res.send({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
    });
  }

  /**
   * PUT /files/:id/unpublish should set isPublic to false on the file document based on the ID:
   * - Retrieve the user based on the token:
   * + If not found, return an error Unauthorized with a status code 401
   * - If no file document is linked to the user and the ID passed as parameter, return an error
   * Not found with a status code 404
   * - Otherwise:
   * + Update the value of isPublic to false
   * + And return the file document with a status code 200
   * @param {Request} req - Express request object.
   * @param {Response} res - Express response object.
   */
  static async putUnpublish(req, res) {
    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db
      .collection('users')
      .findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const idFile = req.params.id || '';

    let fileDocument = await DBClient.db
      .collection('files')
      .findOne({ _id: ObjectId(idFile), userId: user._id });
    if (!fileDocument) return res.status(404).send({ error: 'Not found' });

    await DBClient.db
      .collection('files')
      .update(
        { _id: ObjectId(idFile), userId: user._id },
        { $set: { isPublic: false } },
      );
    fileDocument = await DBClient.db
      .collection('files')
      .findOne({ _id: ObjectId(idFile), userId: user._id });

    return res.send({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
    });
  }

  /**
   * GET /files/:id/data should return the content of the file document based on the ID:
   * - If no file document is linked to the ID passed as parameter, return an error Not found
   * with a status code 404
   * - If the file document (folder or file) is not public (isPublic: false) and no user
   * authenticate or not the owner of the file, return an error Not found with a status code 404
   * - If the type of the file document is folder, return an error A folder doesn't have content
   * with a status code 400
   * - If the file is not locally present, return an error Not found with a status code 404
   * - Otherwise:
   * + By using the module mime-types, get the MIME-type based on the name of the file
   * + Return the content of the file with the correct MIME-type
   * @param {Request} req - Express request object.
   * @param {Response} res - Express response object.
   */
  static async getFile(req, res) {
    const idFile = req.params.id || '';
    const size = req.query.size || 0;

    const fileDocument = await DBClient.db
      .collection('files')
      .findOne({ _id: ObjectId(idFile) });
    if (!fileDocument) return res.status(404).send({ error: 'Not found' });

    const { isPublic } = fileDocument;
    const { userId } = fileDocument;
    const { type } = fileDocument;

    let user = null;
    let owner = false;

    const token = req.header('X-Token') || null;
    if (token) {
      const redisToken = await RedisClient.get(`auth_${token}`);
      if (redisToken) {
        user = await DBClient.db
          .collection('users')
          .findOne({ _id: ObjectId(redisToken) });
        if (user) owner = user._id.toString() === userId.toString();
      }
    }

    if (!isPublic && !owner) return res.status(404).send({ error: 'Not found' });
    if (['folder'].includes(type)) return res.status(400).send({ error: "A folder doesn't have content" });

    const realPath = size === 0 ? fileDocument.localPath : `${fileDocument.localPath}_${size}`;

    try {
      const dataFile = fs.readFileSync(realPath);
      const mimeType = mime.contentType(fileDocument.name);
      res.setHeader('Content-Type', mimeType);
      return res.send(dataFile);
    } catch (error) {
      return res.status(404).send({ error: 'Not found' });
    }
  }
}
