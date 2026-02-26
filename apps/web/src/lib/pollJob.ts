import { api } from './api';

/**
 * Poll a job until it reaches a terminal state (succeeded / failed / blocked).
 * Returns the job object on success, throws on failure.
 */
export function pollJob(jobId: string, intervalMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        const job = await api.get(`/jobs/${jobId}`);
        if (job.status === 'succeeded') {
          clearInterval(poll);
          resolve(job);
        } else if (job.status === 'failed' || job.status === 'blocked') {
          clearInterval(poll);
          reject(new Error(job.error?.message || `Job ${job.status}`));
        }
      } catch (err) {
        clearInterval(poll);
        reject(err);
      }
    }, intervalMs);
  });
}
