import express from 'express';
import * as aiController from '../controllers/aiController.js';

const router = express.Router();

// AI
router.post('/chat', aiController.chat);
router.post('/profile/analyze', aiController.analyzeProfile);
router.post('/planning/generate', aiController.generatePlanning);
router.post('/home/content', aiController.generateHomeContent);

export default router;