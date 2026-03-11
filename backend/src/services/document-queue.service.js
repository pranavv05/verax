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

const enqueueDocumentProcessingJob = async ({ documentId, s3Key, docType, firmId, clientId }) => {
  const queue = getQueue();
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
  enqueueDocumentProcessingJob
};
