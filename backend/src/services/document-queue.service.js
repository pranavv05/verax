const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const env = require("../config/env");
const { DOCUMENT_PROCESSING_QUEUE } = require("../constants/queues");

let queueInstance;
let redisConnection;

const getQueue = () => {
  if (!queueInstance) {
    redisConnection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null
    });
    queueInstance = new Queue(DOCUMENT_PROCESSING_QUEUE, {
      connection: redisConnection
    });
  }

  return queueInstance;
};

// Used by the /health endpoint. Reuses (and lazily creates) the same
// connection enqueueing uses, rather than opening a fresh Redis connection
// on every health-check poll.
const checkRedisHealth = async () => {
  const queue = getQueue();
  await queue.client;
  await redisConnection.ping();
};

// Job states that mean "this document's previous run is over". The job id is
// the document id (so a double-submitted confirm can't queue the same document
// twice), and failed jobs are kept (removeOnFail: false) for inspection. But
// BullMQ silently ignores an add() whose id already exists in ANY state — so
// without clearing a finished job first, reprocessing a document whose last
// run failed permanently was a no-op that still reported success.
const FINISHED_JOB_STATES = new Set(["failed", "completed"]);

const clearFinishedJob = async (queue, jobId) => {
  const existing = await queue.getJob(jobId);
  if (!existing) {
    return;
  }
  const state = await existing.getState();
  if (!FINISHED_JOB_STATES.has(state)) {
    return;
  }
  try {
    await existing.remove();
  } catch (error) {
    // A concurrent enqueue may have removed it first; if it's still there,
    // add() below dedupes against it and we return its id, as before.
    if (await queue.getJob(jobId)) {
      throw error;
    }
  }
};

const enqueueDocumentProcessingJob = async ({ documentId, s3Key, docType, firmId, clientId }) => {
  const queue = getQueue();
  await clearFinishedJob(queue, documentId);
  let job;
  try {
    job = await queue.add(
      "process-document",
      {
        document_id: documentId,
        s3_key: s3Key,
        doc_type: docType,
        firm_id: firmId,
        client_id: clientId
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: false,
        jobId: documentId
      }
    );
  } catch (error) {
    const existing = await queue.getJob(documentId);
    if (existing) {
      return existing.id;
    }
    throw error;
  }

  return job.id;
};

module.exports = {
  enqueueDocumentProcessingJob,
  clearFinishedJob,
  checkRedisHealth
};
