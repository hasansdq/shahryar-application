import express from 'express';
import * as authController from '../controllers/authController.js';
import * as userController from '../controllers/userController.js';
import * as sessionController from '../controllers/sessionController.js';
import * as taskController from '../controllers/taskController.js';
import * as aiController from '../controllers/aiController.js';

const router = express.Router();

// Auth
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// User
router.get('/user/:id', userController.getUser);
router.post('/user/update', userController.updateUser);

// Sessions
router.get('/sessions/:userId', sessionController.getSessions);
router.post('/sessions', sessionController.saveSession);
router.delete('/sessions/:id', sessionController.deleteSession);

// Tasks & Categories
router.get('/tasks/:userId', taskController.getTasks);
router.post('/tasks', taskController.saveTask);
router.delete('/tasks/:userId/:taskId', taskController.deleteTask);
router.get('/categories/:userId', taskController.getCategories);

// AI
router.post('/chat', aiController.chat);
router.post('/profile/analyze', aiController.analyzeProfile);
router.post('/planning/generate', aiController.generatePlanning);
router.post('/home/content', aiController.generateHomeContent);

export default router;