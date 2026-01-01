import express from 'express';
const router = express.Router();
router.get('/', async (req, res) => {
  const blueprints = await req.db.postgres.any('SELECT * FROM blueprints WHERE is_public = true LIMIT 20');
  res.json(blueprints);
});
export { router as blueprintRouter };
