import type { Food } from '../../services/food-catalog';
import type { ClientFood, ClientRecipe } from '../../services/library';
import * as foodCatalog from '../../services/food-catalog';
import * as libraryApi from '../../services/library';
import { loadSession } from '../../services/session';

interface DraftIngredient {
  key: string;
  food: Food;
  gramsText: string;
}

interface LibraryData {
  cloudReady: boolean;
  savedFoods: ClientFood[];
  recipes: ClientRecipe[];
  libraryError: string;
  recipeName: string;
  recipeServings: string;
  editingRecipeId: string;
  ingredientSearchQuery: string;
  ingredientSearchResults: Food[];
  ingredientSearchEmpty: boolean;
  draftIngredients: DraftIngredient[];
  recipeSubmitting: boolean;
  recipeError: string;
}

function draftKey(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

Page<LibraryData, WechatMiniprogram.Page.CustomOption>({
  data: {
    cloudReady: false,
    savedFoods: [],
    recipes: [],
    libraryError: '',
    recipeName: '',
    recipeServings: '1',
    editingRecipeId: '',
    ingredientSearchQuery: '',
    ingredientSearchResults: [],
    ingredientSearchEmpty: false,
    draftIngredients: [],
    recipeSubmitting: false,
    recipeError: '',
  },

  onShow() {
    void this.refresh();
  },

  async refresh() {
    const app = getApp<IAppOption>();
    this.setData({ cloudReady: app.globalData.cloudReady });
    if (!app.globalData.cloudReady) return;

    const session = await loadSession(app);
    if (!session.ok) {
      this.setData({ libraryError: '加载家庭数据失败，请稍后重试。' });
      return;
    }

    try {
      const library = await libraryApi.listLibrary();
      foodCatalog.setLibraryFoods(library.savedFoods, library.recipes);
      this.setData({
        savedFoods: library.savedFoods,
        recipes: library.recipes,
        libraryError: '',
      });
      this.refreshSearch(this.data.ingredientSearchQuery);
    } catch (err) {
      this.setData({ libraryError: libraryApi.toUserMessage(err) });
    }
  },

  refreshSearch(query: string) {
    const results = foodCatalog.searchFoods(query).filter((food) => food.source !== 'recipe');
    this.setData({
      ingredientSearchQuery: query,
      ingredientSearchResults: results,
      ingredientSearchEmpty: results.length === 0,
    });
  },

  onIngredientSearchInput(e: WechatMiniprogram.Input) {
    this.refreshSearch(e.detail.value);
  },

  onClearIngredientSearch() {
    this.refreshSearch('');
  },

  onAddIngredient(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string;
    const food = this.data.ingredientSearchResults.find((item) => item._id === id);
    if (!food) return;
    this.setData({
      draftIngredients: [
        ...this.data.draftIngredients,
        { key: draftKey(), food, gramsText: '100' },
      ],
      recipeError: '',
    });
  },

  onIngredientGrams(e: WechatMiniprogram.Input) {
    const index = Number(e.currentTarget.dataset.index);
    const next = this.data.draftIngredients.slice();
    if (!next[index]) return;
    next[index] = { ...next[index], gramsText: e.detail.value };
    this.setData({ draftIngredients: next });
  },

  onRemoveIngredient(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      draftIngredients: this.data.draftIngredients.filter((_, i) => i !== index),
    });
  },

  onRecipeName(e: WechatMiniprogram.Input) {
    this.setData({ recipeName: e.detail.value });
  },

  onRecipeServings(e: WechatMiniprogram.Input) {
    this.setData({ recipeServings: e.detail.value });
  },

  resetRecipeForm() {
    this.setData({
      recipeName: '',
      recipeServings: '1',
      editingRecipeId: '',
      draftIngredients: [],
      recipeError: '',
    });
  },

  buildRecipeInput() {
    return {
      name: this.data.recipeName,
      servings: Number(this.data.recipeServings),
      ingredients: this.data.draftIngredients.map((ingredient) => ({
        food: ingredient.food,
        grams: Number(ingredient.gramsText),
      })),
    };
  },

  async onSubmitRecipe() {
    if (this.data.recipeSubmitting) return;
    this.setData({ recipeSubmitting: true, recipeError: '' });
    try {
      const input = this.buildRecipeInput();
      if (this.data.editingRecipeId) {
        await libraryApi.updateRecipe(this.data.editingRecipeId, input);
        wx.showToast({ title: '食谱已更新', icon: 'success' });
      } else {
        await libraryApi.createRecipe(input);
        wx.showToast({ title: '食谱已创建', icon: 'success' });
      }
      this.resetRecipeForm();
      await this.refresh();
    } catch (err) {
      this.setData({ recipeError: libraryApi.toUserMessage(err) });
    } finally {
      this.setData({ recipeSubmitting: false });
    }
  },

  onEditRecipe(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string;
    const recipe = this.data.recipes.find((item) => item._id === id);
    if (!recipe) return;
    this.setData({
      recipeName: recipe.name,
      recipeServings: String(recipe.servings),
      editingRecipeId: recipe._id || '',
      draftIngredients: recipe.ingredients.map((ingredient) => ({
        key: draftKey(),
        food: {
          _id: ingredient.foodId,
          linkedFoodId: ingredient.foodSnapshot.linkedFoodId,
          name: ingredient.foodSnapshot.name,
          brand: ingredient.foodSnapshot.brand,
          category: ingredient.foodSnapshot.category,
          per100g: ingredient.foodSnapshot.per100g,
          source: ingredient.foodSnapshot.source,
          isSaved: false,
          nutritionMeta: ingredient.foodSnapshot.nutritionMeta,
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt,
        },
        gramsText: String(ingredient.grams),
      })),
      recipeError: '',
    });
  },

  onCancelRecipeEdit() {
    this.resetRecipeForm();
  },

  onDeleteRecipe(e: WechatMiniprogram.BaseEvent) {
    const recipeId = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '删除食谱',
      content: '确认删除这个食谱吗？删除后将不能继续复用。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await libraryApi.deleteRecipe(recipeId);
          wx.showToast({ title: '已删除', icon: 'success' });
          if (this.data.editingRecipeId === recipeId) {
            this.resetRecipeForm();
          }
          await this.refresh();
        } catch (err) {
          wx.showToast({ title: libraryApi.toUserMessage(err), icon: 'none' });
        }
      },
    });
  },

  onDeleteSavedFood(e: WechatMiniprogram.BaseEvent) {
    const foodId = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '移除收藏',
      content: '确认将这个食品从收藏中移除吗？已有餐食记录不会受影响。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await libraryApi.deleteSavedFood(foodId);
          wx.showToast({ title: '已移除', icon: 'success' });
          await this.refresh();
        } catch (err) {
          wx.showToast({ title: libraryApi.toUserMessage(err), icon: 'none' });
        }
      },
    });
  },
});
