import AppController from '../controllers/AppController';
// import UsersController from '../controllers/UsersController';
// import AuthController from '../controllers/AuthController';
// import FilesController from '../controllers/FilesController';

const express = require('express');
const router = (app) => {
  const route = express.Router();
  app.use(express.json());
  app.use('/', route);

  route.get('/status', (request, response) => AppController.getStatus(request, response));
  route.get('/stats', (request, response) => AppController.getStats(request, response));
};

export default router;
