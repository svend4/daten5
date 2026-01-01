import express from 'express';
const router = express.Router();
router.get('/', (req, res) => res.json({ status: 'ok', service: 'blueprint-engine' }));
export { router as healthRouter };
