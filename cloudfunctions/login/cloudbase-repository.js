/**
 * CloudBase-backed Repository for the cloud functions.
 *
 * Implements the shared `Repository` interface (shared/repository) using
 * wx-server-sdk, returning domain objects (User / FamilyProfile) with
 * server-assigned fields (_id, ownerOpenid, timestamps). All writes go through
 * this trusted boundary; clients cannot reach the database directly.
 *
 * NOTE: this file is duplicated into each cloud function that needs the shared
 * runtime. It is infrastructure, not business logic, and cloud functions are
 * independent deploy units. CloudBase env is resolved via
 * cloud.DYNAMIC_CURRENT_ENV.
 */
const cloud = require('wx-server-sdk');
const db = cloud.database();

function createRepository() {
  const usersCol = db.collection('users');
  const profilesCol = db.collection('family_profiles');

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
    const res = await profilesCol.doc(id).get();
    return res.data || null;
  }

  async function createProfile(profile) {
    const added = await profilesCol.add({ data: profile });
    return { ...profile, _id: added._id };
  }

  async function updateProfile(id, patch) {
    const { _id, ...data } = patch;
    void _id;
    await profilesCol.doc(id).update({ data });
    const res = await profilesCol.doc(id).get();
    return res.data;
  }

  return {
    findUserByOpenid,
    saveUser,
    updateUserDefault,
    listProfiles,
    getProfile,
    createProfile,
    updateProfile,
  };
}

module.exports = { createRepository };
