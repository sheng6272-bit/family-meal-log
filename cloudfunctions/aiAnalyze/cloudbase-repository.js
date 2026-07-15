const cloud = require('wx-server-sdk');

function createRepository() {
  const db = cloud.database();
  const aiAnalysesCol = db.collection('ai_analyses');

  async function createAiAnalysis(analysis) {
    const added = await aiAnalysesCol.add({ data: analysis });
    return { ...analysis, _id: added._id };
  }

  async function getAiAnalysis(id) {
    const res = await aiAnalysesCol.where({ _id: id }).limit(1).get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function resolvePhotoTempUrl(fileId) {
    const result = await cloud.getTempFileURL({
      fileList: [fileId],
    });
    const entry = Array.isArray(result.fileList) ? result.fileList[0] : null;
    const tempUrl = entry && (
      entry.tempFileURL ||
      entry.tempFileUrl ||
      entry.download_url
    );
    if (typeof tempUrl === 'string' && /^https?:\/\//.test(tempUrl)) {
      return tempUrl;
    }
    throw new Error('temporary photo URL could not be resolved');
  }

  return {
    createAiAnalysis,
    getAiAnalysis,
    resolvePhotoTempUrl,
  };
}

module.exports = { createRepository };
