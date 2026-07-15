const cloud = require('wx-server-sdk');

function isDuplicateKeyError(error) {
  const message = String(
    (error && (error.errMsg || error.message || error.error)) || '',
  ).toLowerCase();
  return (
    message.includes('duplicate') ||
    message.includes('e11000') ||
    message.includes('dup key') ||
    message.includes('index')
  );
}

function createRepository() {
  const db = cloud.database();
  const usersCol = db.collection('users');
  const profilesCol = db.collection('family_profiles');
  const mealsCol = db.collection('meals');
  const foodsCol = db.collection('foods');
  const recipesCol = db.collection('recipes');
  const aiAnalysesCol = db.collection('ai_analyses');
  const idempotencyCol = db.collection('idempotency_keys');

  async function findOneById(collection, id) {
    const res = await collection.where({ _id: id }).limit(1).get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function findUserByOpenid(openid) {
    const res = await usersCol.where({ openid }).limit(1).get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function saveUser(user) {
    const res = await usersCol.where({ openid: user.openid }).limit(1).get();
    if (res.data && res.data[0]) {
      const _id = res.data[0]._id;
      const { _id: omittedId, ...data } = user;
      void omittedId;
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
    return findOneById(profilesCol, id);
  }

  async function createProfile(profile) {
    const added = await profilesCol.add({ data: profile });
    return { ...profile, _id: added._id };
  }

  async function updateProfile(id, patch) {
    const { _id, ...data } = patch;
    void _id;
    await profilesCol.doc(id).update({ data });
    return findOneById(profilesCol, id);
  }

  async function createMeal(meal) {
    try {
      const added = await mealsCol.add({ data: meal });
      return { ...meal, _id: added._id };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // With a unique index on (ownerOpenid, requestId), duplicate-key means
        // the original request already won the race. Re-read and return it.
        const duplicate = await mealsCol
          .where({ ownerOpenid: meal.ownerOpenid, requestId: meal.requestId })
          .limit(1)
          .get();
        if (duplicate.data && duplicate.data[0]) return duplicate.data[0];
      }
      throw error;
    }
  }

  async function getMeal(id) {
    return findOneById(mealsCol, id);
  }

  async function listMeals(openid, familyProfileId, date) {
    const res = await mealsCol
      .where({ ownerOpenid: openid, familyProfileId, date })
      .orderBy('createdAt', 'asc')
      .get();
    return res.data || [];
  }

  async function updateMeal(id, patch) {
    const { _id, ...data } = patch;
    void _id;
    await mealsCol.doc(id).update({ data });
    return findOneById(mealsCol, id);
  }

  async function deleteMeal(id) {
    await mealsCol.doc(id).remove();
  }

  async function listFoods(openid) {
    const res = await foodsCol
      .where({ ownerOpenid: openid })
      .orderBy('updatedAt', 'desc')
      .get();
    return res.data || [];
  }

  async function getFood(id) {
    return findOneById(foodsCol, id);
  }

  async function createFood(food) {
    const added = await foodsCol.add({ data: food });
    return { ...food, _id: added._id };
  }

  async function deleteFood(id) {
    await foodsCol.doc(id).remove();
  }

  async function listRecipes(openid) {
    const res = await recipesCol
      .where({ ownerOpenid: openid })
      .orderBy('updatedAt', 'desc')
      .get();
    return res.data || [];
  }

  async function getRecipe(id) {
    return findOneById(recipesCol, id);
  }

  async function createRecipe(recipe) {
    const added = await recipesCol.add({ data: recipe });
    return { ...recipe, _id: added._id };
  }

  async function updateRecipe(id, patch) {
    const { _id, ...data } = patch;
    void _id;
    await recipesCol.doc(id).update({ data });
    return findOneById(recipesCol, id);
  }

  async function deleteRecipe(id) {
    await recipesCol.doc(id).remove();
  }

  async function createAiAnalysis(analysis) {
    const added = await aiAnalysesCol.add({ data: analysis });
    return { ...analysis, _id: added._id };
  }

  async function getAiAnalysis(id) {
    return findOneById(aiAnalysesCol, id);
  }

  async function findIdempotencyKey(ownerOpenid, operation, requestId) {
    const res = await idempotencyCol
      .where({ ownerOpenid, operation, requestId })
      .limit(1)
      .get();
    return res.data && res.data[0] ? res.data[0] : null;
  }

  async function saveIdempotencyKey(record) {
    try {
      await idempotencyCol.add({ data: record });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
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
    listMeals,
    updateMeal,
    deleteMeal,
    listFoods,
    getFood,
    createFood,
    deleteFood,
    listRecipes,
    getRecipe,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    createAiAnalysis,
    getAiAnalysis,
    findIdempotencyKey,
    saveIdempotencyKey,
  };
}

module.exports = { createRepository, isDuplicateKeyError };
