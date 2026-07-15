const cloud = require('wx-server-sdk');

function createRepository() {
  const db = cloud.database();
  const usersCol = db.collection('users');
  const profilesCol = db.collection('family_profiles');
  const mealsCol = db.collection('meals');
  const idempotencyCol = db.collection('idempotency_keys');

  async function findUserByOpenid(openid) {
    const res = await usersCol.where({ openid }).limit(1).get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function saveUser(user) {
    const res = await usersCol.where({ openid: user.openid }).limit(1).get();
    if (res.data && res.data[0]) {
      const _id = res.data[0]._id;
      const { _id: _omit, ...data } = user;
      void _omit;
      await usersCol.doc(_id).update({ data });
      return { ...user, _id };
    }
    const added = await usersCol.add({ data: user });
    return { ...user, _id: added._id };
  }

  async function updateUserDefault(openid, profileId) {
    const res = await usersCol.where({ openid }).limit(1).get();
    if (res.data && res.data[0]) {
      await usersCol.doc(res.data[0]._id).update({
        data: { defaultFamilyProfileId: profileId || null, updatedAt: Date.now() },
      });
    }
  }

  async function listProfiles(openid) {
    const res = await profilesCol
      .where({ ownerOpenid: openid })
      .orderBy('createdAt', 'asc')
      .get();
    return res.data || [];
  }

  async function getProfile(id) {
    const res = await profilesCol.where({ _id: id }).limit(1).get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function createProfile(profile) {
    const added = await profilesCol.add({ data: profile });
    return { ...profile, _id: added._id };
  }

  async function updateProfile(id, patch) {
    const { _id, ...data } = patch;
    void _id;
    await profilesCol.doc(id).update({ data });
    const res = await profilesCol.where({ _id: id }).limit(1).get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function createMeal(meal) {
    const existing = await mealsCol
      .where({ ownerOpenid: meal.ownerOpenid, requestId: meal.requestId })
      .limit(1)
      .get();
    if (existing.data && existing.data[0]) return existing.data[0];

    try {
      const added = await mealsCol.add({ data: meal });
      return { ...meal, _id: added._id };
    } catch (err) {
      const duplicate = await mealsCol
        .where({ ownerOpenid: meal.ownerOpenid, requestId: meal.requestId })
        .limit(1)
        .get();
      if (duplicate.data && duplicate.data[0]) return duplicate.data[0];
      throw err;
    }
  }

  async function getMeal(id) {
    const res = await mealsCol.where({ _id: id }).limit(1).get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function findIdempotencyKey(ownerOpenid, operation, requestId) {
    const res = await idempotencyCol
      .where({ ownerOpenid, operation, requestId })
      .limit(1)
      .get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function saveIdempotencyKey(record) {
    const existing = await findIdempotencyKey(
      record.ownerOpenid,
      record.operation,
      record.requestId,
    );
    if (existing) return;
    await idempotencyCol.add({ data: record });
  }

  return {
    findUserByOpenid,
    saveUser,
    updateUserDefault,
    listProfiles,
    getProfile,
    createProfile,
    updateProfile,
    createMeal,
    getMeal,
    findIdempotencyKey,
    saveIdempotencyKey,
  };
}

module.exports = { createRepository };
