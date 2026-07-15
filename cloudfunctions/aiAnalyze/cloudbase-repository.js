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

  return {
    createAiAnalysis,
    getAiAnalysis,
  };
}

module.exports = { createRepository };
