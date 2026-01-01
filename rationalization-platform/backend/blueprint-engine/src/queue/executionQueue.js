import Bull from 'bull';
export async function initQueue(db, executor) {
  const queue = new Bull('blueprint-executions', {
    redis: { host: process.env.REDIS_HOST || 'localhost', port: 6379 }
  });
  queue.process(async (job) => {
    return await executor.execute(job.data.blueprintId, job.data.parameters);
  });
  return queue;
}
