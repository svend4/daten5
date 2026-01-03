import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  const { blueprintId, parameters } = req.body;
  const result = await req.executor.execute(blueprintId, parameters);
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const status = await req.executor.getExecutionStatus(req.params.id);
  res.json(status || { error: 'Not found' });
});

router.post('/:id/cancel', async (req, res) => {
  const result = await req.executor.cancelExecution(req.params.id);
  res.json(result);
});

export { router as executionRouter };
