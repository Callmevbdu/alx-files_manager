import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const express = require('express');

const router = (app) => {
  const route = express.Router();
  app.use(express.json());
  app.use('/', route);

  route.get('/status', (request, response) => AppController.getStatus(request, response));
  route.get('/stats', (request, response) => AppController.getStats(request, response));

  route.post('/users', (request, response) => UsersController.postNew(request, response));

  route.get('/connect', (request, response) => AuthController.getConnect(request, response));
  route.get('/disconnect', (request, response) => AuthController.getDisconnect(request, response));
  route.get('/users/me', (request, response) => UsersController.getMe(request, response));

  route.post('/files', (request, response) => FilesController.postUpload(request, response));
};

export default router;
