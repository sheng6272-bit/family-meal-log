import type { MealType, ItemSource } from '../../../shared/constants';
import type { AiAnalysisResult, NutritionValues } from '../../../shared/types';
import type { ClientMeal } from '../../services/meal';
import type { ClientFood, ClientRecipe } from '../../services/library';
import * as foodCatalog from '../../services/food-catalog';
import * as mealApi from '../../services/meal';
import * as libraryApi from '../../services/library';
import { analyzeMealPhoto } from '../../services/ai/ai-adapter';
import { loadSession } from '../../services/session';

interface PreviewNumbers {
  grams: number;
  calories: number;
  protein: number;
  carb: number;
  fat: number;
}

interface PreviewText {
  grams: string;
  calories: string;
  protein: string;
  carb: string;
  fat: string;
}

interface DraftMealItem {
  draftKey: string;
  food: foodCatalog.Food;
  quantity: number;
  portionLabel: string;
  portionGramsPerUnit: number;
  grams: number;
  nutrition: NutritionValues;
  source: ItemSource;
  display: PreviewText;
}

interface SavedMealSummary {
  mealId: string;
  date: string;
  mealTypeLabel: string;
  itemCount: number;
  totals: PreviewText;
}

interface AiSuggestionDraft {
  key: string;
  foodName: string;
  gramsText: string;
  confidenceText: string;
  matchedFoodId?: string;
  per100gGuess?: NutritionValues;
}

interface AddMealData {
  mode: 'create' | 'edit';
  editingMealId?: string;
  loadedMealId?: string;
  cloudReady: boolean;
  activeProfileId?: string;
  activeProfileName: string;
  mealDate: string;
  mealTypes: { key: MealType; label: string }[];
  selectedMealType: MealType;
  savedFoods: ClientFood[];
  recipes: ClientRecipe[];
  searchQuery: string;
  searchResults: foodCatalog.Food[];
  searchEmpty: boolean;
  selectedFood: foodCatalog.Food | null;
  selectedFoodId: string;
  selectedFoodSaved: boolean;
  showCustomForm: boolean;
  customName: string;
  customBrand: string;
  customCategory: string;
  customCalories: string;
  customProtein: string;
  customCarb: string;
  customFat: string;
  customError: string;
  customSubmitting: boolean;
  portionUnits: foodCatalog.PortionUnit[];
  selectedUnitIndex: number;
  quantity: string;
  preview: PreviewNumbers | null;
  previewText: PreviewText | null;
  previewError: string;
  draftItems: DraftMealItem[];
  draftTotalText: PreviewText | null;
  editingItemIndex: number;
  currentRequestId: string;
  photoPreviewPath: string;
  photoFileId?: string;
  photoUploading: boolean;
  photoError: string;
  aiSubmitting: boolean;
  aiError: string;
  aiAnalysisId?: string;
  aiSuggestions: AiSuggestionDraft[];
  saveSubmitting: boolean;
  saveEnabled: boolean;
  saveError: string;
  lastSavedSummary: SavedMealSummary | null;
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toPreviewText(grams: number, nutrition: NutritionValues): PreviewText {
  return {
    grams: grams.toFixed(1),
    calories: nutrition.calories.toFixed(1),
    protein: nutrition.protein.toFixed(1),
    carb: nutrition.carb.toFixed(1),
    fat: nutrition.fat.toFixed(1),
  };
}

function toDraftKey(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildSavedMealSummary(meal: ClientMeal): SavedMealSummary {
  return {
    mealId: meal._id,
    date: meal.date,
    mealTypeLabel: MEAL_TYPE_LABELS[meal.mealType],
    itemCount: meal.items.length,
    totals: toPreviewText(meal.items.reduce((sum, item) => sum + item.grams, 0), meal.totals),
  };
}

function findSavedFoodMatch(
  food: foodCatalog.Food | null,
  savedFoods: ClientFood[],
): ClientFood | undefined {
  if (!food) return undefined;
  return savedFoods.find((saved) => {
    if (saved._id === food._id) return true;
    if (food.source === 'system' && saved.linkedFoodId === food._id) return true;
    if (
      !food._id &&
      !food.linkedFoodId &&
      saved.name === food.name &&
      saved.brand === food.brand &&
      saved.category === food.category &&
      saved.per100g.calories === food.per100g.calories &&
      saved.per100g.protein === food.per100g.protein &&
      saved.per100g.carb === food.per100g.carb &&
      saved.per100g.fat === food.per100g.fat
    ) {
      return true;
    }
    return !!food.linkedFoodId && food.linkedFoodId === saved.linkedFoodId;
  });
}

function makeDraftFoodFromItem(
  item: ClientMeal['items'][number],
  createdAt: number,
  updatedAt: number,
): foodCatalog.Food {
  return {
    _id: item.foodId,
    linkedFoodId: item.foodSnapshot.linkedFoodId,
    name: item.foodSnapshot.name,
    brand: item.foodSnapshot.brand,
    category: item.foodSnapshot.category,
    per100g: item.foodSnapshot.per100g,
    source: item.foodSnapshot.source,
    isSaved: false,
    nutritionMeta: item.foodSnapshot.nutritionMeta,
    createdAt,
    updatedAt,
  };
}

function buildDraftItemsFromMeal(meal: ClientMeal): DraftMealItem[] {
  return meal.items.map((item) => ({
    draftKey: toDraftKey(),
    food: makeDraftFoodFromItem(item, meal.createdAt, meal.updatedAt),
    quantity: item.quantity,
    portionLabel: item.portionLabel,
    portionGramsPerUnit: item.portionGramsPerUnit,
    grams: item.grams,
    nutrition: item.nutrition,
    source: item.source,
    display: toPreviewText(item.grams, item.nutrition),
  }));
}

Page<AddMealData, WechatMiniprogram.Page.CustomOption>({
  data: {
    mode: 'create',
    editingMealId: undefined,
    loadedMealId: undefined,
    cloudReady: false,
    activeProfileId: undefined,
    activeProfileName: '未选择成员',
    mealDate: todayIso(),
    mealTypes: [
      { key: 'breakfast', label: '早餐' },
      { key: 'lunch', label: '午餐' },
      { key: 'dinner', label: '晚餐' },
      { key: 'snack', label: '加餐' },
    ],
    selectedMealType: 'breakfast',
    savedFoods: [],
    recipes: [],
    searchQuery: '',
    searchResults: [],
    searchEmpty: false,
    selectedFood: null,
    selectedFoodId: '',
    selectedFoodSaved: false,
    showCustomForm: false,
    customName: '',
    customBrand: '',
    customCategory: '',
    customCalories: '',
    customProtein: '',
    customCarb: '',
    customFat: '',
    customError: '',
    customSubmitting: false,
    portionUnits: [],
    selectedUnitIndex: 0,
    quantity: '1',
    preview: null,
    previewText: null,
    previewError: '',
    draftItems: [],
    draftTotalText: null,
    editingItemIndex: -1,
    currentRequestId: mealApi.newMealRequestId(),
    photoPreviewPath: '',
    photoFileId: undefined,
    photoUploading: false,
    photoError: '',
    aiSubmitting: false,
    aiError: '',
    aiAnalysisId: undefined,
    aiSuggestions: [],
    saveSubmitting: false,
    saveEnabled: false,
    saveError: '',
    lastSavedSummary: null,
  },

  onLoad(query: Record<string, string | undefined>) {
    const mealId = typeof query.mealId === 'string' ? query.mealId.trim() : '';
    if (mealId) {
      this.setData({
        mode: 'edit',
        editingMealId: mealId,
      });
      wx.setNavigationBarTitle({ title: '编辑餐食' });
    } else {
      wx.setNavigationBarTitle({ title: '新增餐食' });
    }
    this.refreshSearch('');
  },

  onShow() {
    void this.refreshSessionState();
  },

  async refreshSessionState() {
    const app = getApp<IAppOption>();
    if (app.globalData.cloudReady) {
      const res = await loadSession(app);
      if (!res.ok) {
        this.setData({
          cloudReady: true,
          activeProfileId: undefined,
          activeProfileName: '成员加载失败',
        });
        this.syncSaveEnabled({ cloudReady: true, activeProfileId: undefined });
        return;
      }
      await this.refreshLibrary();
    }

    const active = (app.globalData.profiles || []).find(
      (profile) => profile._id === app.globalData.activeFamilyProfileId,
    );
    this.setData({
      cloudReady: app.globalData.cloudReady,
      activeProfileId: active?._id,
      activeProfileName: active ? active.name : '未选择成员',
    });
    this.syncSaveEnabled({
      cloudReady: app.globalData.cloudReady,
      activeProfileId: active?._id,
    });

    if (
      this.data.mode === 'edit' &&
      this.data.editingMealId &&
      this.data.loadedMealId !== this.data.editingMealId &&
      app.globalData.cloudReady
    ) {
      await this.loadExistingMeal(this.data.editingMealId);
    }
  },

  async refreshLibrary() {
    try {
      const library = await libraryApi.listLibrary();
      foodCatalog.setLibraryFoods(library.savedFoods, library.recipes);
      this.setData({
        savedFoods: library.savedFoods,
        recipes: library.recipes,
      });
      this.refreshSearch(this.data.searchQuery);
      this.syncSelectedFoodSaved();
    } catch (err) {
      console.warn('[library] refresh failed', err);
    }
  },

  async loadExistingMeal(mealId: string) {
    try {
      const meal = await mealApi.getMeal(mealId);
      const draftItems = buildDraftItemsFromMeal(meal);
      this.setData({
        loadedMealId: meal._id,
        mealDate: meal.date,
        selectedMealType: meal.mealType,
        draftItems,
        draftTotalText: draftItems.length
          ? toPreviewText(
              draftItems.reduce((sum, item) => sum + item.grams, 0),
              foodCatalog.sumNutritionList(draftItems.map((item) => item.nutrition)),
            )
          : null,
        photoFileId: meal.photoFileId,
        photoPreviewPath: meal.photoFileId || '',
        aiAnalysisId: meal.aiAnalysisId,
        lastSavedSummary: buildSavedMealSummary(meal),
        saveError: '',
      });
      this.syncSaveEnabled({}, draftItems);
    } catch (err) {
      this.setData({ saveError: mealApi.toUserMessage(err) });
    }
  },

  onDateChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ mealDate: e.detail.value as string });
  },

  onSelectMealType(e: WechatMiniprogram.BaseEvent) {
    const key = e.currentTarget.dataset.key as MealType;
    this.setData({ selectedMealType: key });
  },

  onOpenLibrary() {
    wx.navigateTo({ url: '/pages/library/library' });
  },

  refreshSearch(query: string) {
    const results = foodCatalog.searchFoods(query);
    this.setData({
      searchQuery: query,
      searchResults: results,
      searchEmpty: results.length === 0,
    });
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    this.refreshSearch(e.detail.value);
  },

  onClearSearch() {
    this.refreshSearch('');
  },

  onSelectFood(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string;
    const food = this.data.searchResults.find((item) => item._id === id) || null;
    if (!food) return;
    this.selectFood(food);
  },

  syncSelectedFoodSaved() {
    this.setData({
      selectedFoodSaved: !!findSavedFoodMatch(this.data.selectedFood, this.data.savedFoods),
    });
  },

  selectFood(food: foodCatalog.Food) {
    const units = foodCatalog.getPortionUnits(food);
    const defaultUnit = foodCatalog.getDefaultPortionUnit(units);
    const selectedUnitIndex = defaultUnit
      ? Math.max(
          units.findIndex((unit) => unit.label === defaultUnit.label),
          0,
        )
      : 0;

    this.setData({
      selectedFood: food,
      selectedFoodId: food._id || '',
      selectedFoodSaved: !!findSavedFoodMatch(food, this.data.savedFoods),
      portionUnits: units,
      selectedUnitIndex,
      quantity: '1',
      previewError: '',
      preview: null,
      previewText: null,
      customError: '',
      showCustomForm: false,
    });
    this.computePreview();
  },

  async onToggleSaveFood() {
    const selectedFood = this.data.selectedFood;
    if (!selectedFood || selectedFood.source === 'recipe') return;
    const savedMatch = findSavedFoodMatch(selectedFood, this.data.savedFoods);
    try {
      if (savedMatch) {
        await libraryApi.deleteSavedFood(savedMatch._id);
        wx.showToast({ title: '已取消收藏', icon: 'success' });
      } else {
        await libraryApi.saveFood(selectedFood);
        wx.showToast({ title: '已加入收藏', icon: 'success' });
      }
      await this.refreshLibrary();
    } catch (err) {
      wx.showToast({ title: libraryApi.toUserMessage(err), icon: 'none' });
    }
  },

  onShowCustomForm() {
    this.setData({
      showCustomForm: true,
      customName: '',
      customBrand: '',
      customCategory: '',
      customCalories: '',
      customProtein: '',
      customCarb: '',
      customFat: '',
      customError: '',
    });
  },

  onHideCustomForm() {
    this.setData({ showCustomForm: false, customError: '' });
  },

  onCustomName(e: WechatMiniprogram.Input) {
    this.setData({ customName: e.detail.value });
  },

  onCustomBrand(e: WechatMiniprogram.Input) {
    this.setData({ customBrand: e.detail.value });
  },

  onCustomCategory(e: WechatMiniprogram.Input) {
    this.setData({ customCategory: e.detail.value });
  },

  onCustomCalories(e: WechatMiniprogram.Input) {
    this.setData({ customCalories: e.detail.value });
  },

  onCustomProtein(e: WechatMiniprogram.Input) {
    this.setData({ customProtein: e.detail.value });
  },

  onCustomCarb(e: WechatMiniprogram.Input) {
    this.setData({ customCarb: e.detail.value });
  },

  onCustomFat(e: WechatMiniprogram.Input) {
    this.setData({ customFat: e.detail.value });
  },

  onSubmitCustom() {
    if (this.data.customSubmitting) return;
    const toNum = (value: string): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : NaN;
    };

    this.setData({ customSubmitting: true });
    try {
      const food = foodCatalog.createAdHocFood({
        name: this.data.customName,
        brand: this.data.customBrand,
        category: this.data.customCategory,
        calories: toNum(this.data.customCalories),
        protein: toNum(this.data.customProtein),
        carb: toNum(this.data.customCarb),
        fat: toNum(this.data.customFat),
      });
      this.refreshSearch(this.data.searchQuery);
      this.selectFood(food);
      this.setData({ showCustomForm: false, customError: '' });
      wx.showToast({ title: '已添加自定义食品', icon: 'success' });
    } catch (err) {
      this.setData({ customError: foodCatalog.toUserMessage(err) });
    } finally {
      this.setData({ customSubmitting: false });
    }
  },

  onUnitChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ selectedUnitIndex: Number(e.detail.value) });
    this.computePreview();
  },

  onQuantityInput(e: WechatMiniprogram.Input) {
    this.setData({ quantity: e.detail.value });
    this.computePreview();
  },

  computePreview() {
    const food = this.data.selectedFood;
    const unit = this.data.portionUnits[this.data.selectedUnitIndex];
    if (!food || !unit) {
      this.setData({ preview: null, previewText: null, previewError: '' });
      return;
    }

    const quantity = Number(this.data.quantity);
    if (!Number.isFinite(quantity)) {
      this.setData({ preview: null, previewText: null, previewError: '' });
      return;
    }
    if (quantity <= 0) {
      this.setData({ preview: null, previewText: null, previewError: '数量必须大于 0' });
      return;
    }

    try {
      const preview = foodCatalog.computePreview(food, unit, quantity);
      this.setData({
        preview: { grams: preview.grams, ...preview.nutrition },
        previewText: toPreviewText(preview.grams, preview.nutrition),
        previewError: '',
      });
    } catch (err) {
      this.setData({
        preview: null,
        previewText: null,
        previewError: foodCatalog.toUserMessage(err),
      });
    }
  },

  buildDraftItem(source: ItemSource): DraftMealItem {
    const food = this.data.selectedFood;
    const unit = this.data.portionUnits[this.data.selectedUnitIndex];
    const preview = this.data.preview;
    if (!food || !unit || !preview) {
      throw new Error('请先选择食品并完成份量预览。');
    }
    const quantity = Number(this.data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('数量必须大于 0');
    }

    return {
      draftKey: toDraftKey(),
      food,
      quantity,
      portionLabel: unit.label,
      portionGramsPerUnit: unit.gramsPerUnit,
      grams: preview.grams,
      nutrition: {
        calories: preview.calories,
        protein: preview.protein,
        carb: preview.carb,
        fat: preview.fat,
      },
      source,
      display: toPreviewText(preview.grams, {
        calories: preview.calories,
        protein: preview.protein,
        carb: preview.carb,
        fat: preview.fat,
      }),
    };
  },

  syncDraftTotal(nextItems?: DraftMealItem[]) {
    const items = nextItems ?? this.data.draftItems;
    if (items.length === 0) {
      this.setData({ draftTotalText: null });
      return;
    }
    const totals = foodCatalog.sumNutritionList(items.map((item) => item.nutrition));
    const grams = items.reduce((sum, item) => sum + item.grams, 0);
    this.setData({ draftTotalText: toPreviewText(grams, totals) });
  },

  syncSaveEnabled(
    overrides: Partial<Pick<AddMealData, 'cloudReady' | 'activeProfileId' | 'saveSubmitting'>> = {},
    nextItems?: DraftMealItem[],
  ) {
    const items = nextItems ?? this.data.draftItems;
    const cloudReady = overrides.cloudReady ?? this.data.cloudReady;
    const activeProfileId = overrides.activeProfileId ?? this.data.activeProfileId;
    const saveSubmitting = overrides.saveSubmitting ?? this.data.saveSubmitting;
    this.setData({
      saveEnabled: !!cloudReady && !!activeProfileId && items.length > 0 && !saveSubmitting,
    });
  },

  resetEditor() {
    this.setData({
      selectedFood: null,
      selectedFoodId: '',
      selectedFoodSaved: false,
      portionUnits: [],
      selectedUnitIndex: 0,
      quantity: '1',
      preview: null,
      previewText: null,
      previewError: '',
      editingItemIndex: -1,
    });
  },

  onUpsertDraftItem() {
    try {
      const editingIndex = this.data.editingItemIndex;
      const source =
        editingIndex >= 0 ? this.data.draftItems[editingIndex].source : 'manual';
      const nextItem = this.buildDraftItem(source);
      const nextItems = this.data.draftItems.slice();
      if (editingIndex >= 0) {
        nextItem.draftKey = nextItems[editingIndex].draftKey;
        nextItems.splice(editingIndex, 1, nextItem);
      } else {
        nextItems.push(nextItem);
      }
      this.setData({
        draftItems: nextItems,
        saveError: '',
      });
      this.syncDraftTotal(nextItems);
      this.syncSaveEnabled({}, nextItems);
      this.resetEditor();
      wx.showToast({
        title: editingIndex >= 0 ? '条目已更新' : '已加入本餐',
        icon: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加失败，请重试。';
      this.setData({ previewError: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  onEditDraftItem(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.draftItems[index];
    if (!item) return;
    const portionUnits = foodCatalog.getPortionUnits(item.food);
    const selectedUnitIndex = Math.max(
      portionUnits.findIndex((unit) => unit.label === item.portionLabel),
      0,
    );
    this.setData({
      selectedFood: item.food,
      selectedFoodId: item.food._id || '',
      selectedFoodSaved: !!findSavedFoodMatch(item.food, this.data.savedFoods),
      portionUnits,
      selectedUnitIndex,
      quantity: String(item.quantity),
      editingItemIndex: index,
    });
    this.computePreview();
  },

  onCancelEdit() {
    this.resetEditor();
  },

  onRemoveDraftItem(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const nextItems = this.data.draftItems.filter((_, itemIndex) => itemIndex !== index);
    const editingIndex = this.data.editingItemIndex;
    this.setData({ draftItems: nextItems });
    this.syncDraftTotal(nextItems);
    this.syncSaveEnabled({}, nextItems);
    if (editingIndex === index) {
      this.resetEditor();
    } else if (editingIndex > index) {
      this.setData({ editingItemIndex: editingIndex - 1 });
    }
  },

  async onChoosePhoto() {
    if (!this.data.cloudReady) {
      wx.showToast({ title: '当前离线，无法上传照片。', icon: 'none' });
      return;
    }
    if (this.data.photoUploading) return;

    const chooseMedia = () =>
      new Promise<string>((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          success: (res) => {
            const file = (res.tempFiles && res.tempFiles[0]) as
              | { tempFilePath?: string }
              | undefined;
            if (file && typeof file.tempFilePath === 'string') {
              resolve(file.tempFilePath);
            } else {
              reject(new Error('no_temp_file'));
            }
          },
          fail: reject,
        });
      });

    const uploadPhoto = (tempFilePath: string) =>
      new Promise<string>((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath: `meal-photos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
          filePath: tempFilePath,
          success: (res) => resolve(res.fileID),
          fail: reject,
        });
      });

    this.setData({ photoUploading: true, photoError: '' });
    try {
      const tempFilePath = await chooseMedia();
      const fileId = await uploadPhoto(tempFilePath);
      this.setData({
        photoPreviewPath: tempFilePath,
        photoFileId: fileId,
        photoError: '',
      });
      wx.showToast({ title: '照片已上传', icon: 'success' });
    } catch (err) {
      console.warn('[photo] upload failed', err);
      this.setData({
        photoError: '照片上传失败，但你仍然可以继续手动保存餐食。',
        photoFileId: undefined,
      });
      wx.showToast({ title: '照片上传失败', icon: 'none' });
    } finally {
      this.setData({ photoUploading: false });
    }
  },

  onClearPhoto() {
    this.setData({
      photoPreviewPath: '',
      photoFileId: undefined,
      photoError: '',
      aiSuggestions: [],
      aiAnalysisId: undefined,
      aiError: '',
    });
  },

  async onAnalyzePhoto() {
    if (this.data.aiSubmitting) return;
    if (!this.data.photoFileId) {
      wx.showToast({ title: '请先上传一张餐食照片。', icon: 'none' });
      return;
    }

    this.setData({ aiSubmitting: true, aiError: '' });
    try {
      const result: AiAnalysisResult = await analyzeMealPhoto({
        ownerOpenid: '',
        photoFileId: this.data.photoFileId,
        hintMealType: this.data.selectedMealType,
      });
      if (result.status !== 'succeeded' || result.suggestions.length === 0) {
        const aiError =
          result.errorMessage && /disabled/i.test(result.errorMessage)
            ? 'AI 功能当前已关闭，请继续手动添加。'
            : 'AI 暂时没有返回可用建议，请继续手动添加。';
        this.setData({
          aiSuggestions: [],
          aiAnalysisId: result.analysisId,
          aiError,
        });
        return;
      }
      this.setData({
        aiAnalysisId: result.analysisId,
        aiSuggestions: result.suggestions.map((suggestion) => ({
          key: toDraftKey(),
          foodName: suggestion.foodName,
          gramsText: String(suggestion.estimatedGrams),
          confidenceText: `${Math.round(suggestion.confidence * 100)}%`,
          matchedFoodId: suggestion.matchedFoodId,
          per100gGuess: suggestion.per100gGuess,
        })),
        aiError: '',
      });
    } catch (err) {
      console.warn('[ai] analyze failed', err);
      this.setData({ aiError: 'AI 分析失败，请继续手动录入。' });
    } finally {
      this.setData({ aiSubmitting: false });
    }
  },

  onAiNameInput(e: WechatMiniprogram.Input) {
    const index = Number(e.currentTarget.dataset.index);
    const next = this.data.aiSuggestions.slice();
    if (!next[index]) return;
    next[index] = { ...next[index], foodName: e.detail.value };
    this.setData({ aiSuggestions: next });
  },

  onAiGramsInput(e: WechatMiniprogram.Input) {
    const index = Number(e.currentTarget.dataset.index);
    const next = this.data.aiSuggestions.slice();
    if (!next[index]) return;
    next[index] = { ...next[index], gramsText: e.detail.value };
    this.setData({ aiSuggestions: next });
  },

  onDismissAiSuggestion(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({
      aiSuggestions: this.data.aiSuggestions.filter((_, i) => i !== index),
    });
  },

  onAddAiSuggestion(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const suggestion = this.data.aiSuggestions[index];
    if (!suggestion) return;

    try {
      const grams = Number(suggestion.gramsText);
      if (!Number.isFinite(grams) || grams <= 0) {
        throw new Error('AI 建议的克数必须大于 0。');
      }

      let food = suggestion.matchedFoodId
        ? foodCatalog.findFoodById(suggestion.matchedFoodId)
        : undefined;

      if (food && suggestion.foodName.trim() && suggestion.foodName.trim() !== food.name) {
        food = foodCatalog.createAdHocFood({
          name: suggestion.foodName.trim(),
          brand: food.brand,
          category: food.category,
          calories: food.per100g.calories,
          protein: food.per100g.protein,
          carb: food.per100g.carb,
          fat: food.per100g.fat,
        });
      }

      if (!food) {
        if (!suggestion.per100gGuess) {
          throw new Error('AI 建议缺少营养信息，无法直接加入本餐。');
        }
        food = foodCatalog.createAdHocFood({
          name: suggestion.foodName,
          calories: suggestion.per100gGuess.calories,
          protein: suggestion.per100gGuess.protein,
          carb: suggestion.per100gGuess.carb,
          fat: suggestion.per100gGuess.fat,
        });
      }

      const gUnit = foodCatalog.getPortionUnits(food).find((unit) => unit.label === 'g');
      if (!gUnit) throw new Error('当前食品缺少克数单位。');

      const preview = foodCatalog.computePreview(food, gUnit, grams);
      const nextItem: DraftMealItem = {
        draftKey: toDraftKey(),
        food,
        quantity: grams,
        portionLabel: gUnit.label,
        portionGramsPerUnit: gUnit.gramsPerUnit,
        grams: preview.grams,
        nutrition: preview.nutrition,
        source: 'ai_suggested',
        display: toPreviewText(preview.grams, preview.nutrition),
      };
      const nextItems = [...this.data.draftItems, nextItem];
      this.setData({
        draftItems: nextItems,
        aiSuggestions: this.data.aiSuggestions.filter((_, i) => i !== index),
        saveError: '',
      });
      this.syncDraftTotal(nextItems);
      this.syncSaveEnabled({}, nextItems);
      wx.showToast({ title: 'AI 建议已加入草稿', icon: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI 建议处理失败。';
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  buildMealPayload() {
    return {
      familyProfileId: this.data.activeProfileId,
      date: this.data.mealDate,
      mealType: this.data.selectedMealType,
      note: undefined,
      photoFileId: this.data.photoFileId,
      aiAnalysisId: this.data.aiAnalysisId,
      items: this.data.draftItems.map((item) => ({
        food: item.food,
        quantity: item.quantity,
        portionLabel: item.portionLabel,
        source: item.source,
      })),
    };
  },

  async onSave() {
    if (this.data.saveSubmitting) return;
    if (!this.data.cloudReady) {
      wx.showToast({ title: '当前离线，无法保存到云端。', icon: 'none' });
      return;
    }
    if (!this.data.activeProfileId) {
      wx.showToast({ title: '请先选择家庭成员。', icon: 'none' });
      return;
    }
    if (this.data.draftItems.length === 0) {
      wx.showToast({ title: '请先添加至少一项食品。', icon: 'none' });
      return;
    }

    this.setData({ saveSubmitting: true, saveError: '' });
    this.syncSaveEnabled({ saveSubmitting: true });

    try {
      let saved: ClientMeal;
      if (this.data.mode === 'edit' && this.data.editingMealId) {
        saved = await mealApi.updateMeal(this.data.editingMealId, this.buildMealPayload());
      } else {
        saved = await mealApi.createMeal({
          requestId: this.data.currentRequestId,
          ...this.buildMealPayload(),
        });
      }
      const reloaded = await mealApi.getMeal(saved._id);
      if (this.data.mode === 'edit') {
        await this.loadExistingMeal(reloaded._id);
      } else {
        const nextRequestId = mealApi.newMealRequestId();
        this.setData({
          draftItems: [],
          draftTotalText: null,
          lastSavedSummary: buildSavedMealSummary(reloaded),
          currentRequestId: nextRequestId,
          aiSuggestions: [],
          aiAnalysisId: undefined,
          photoPreviewPath: '',
          photoFileId: undefined,
          photoError: '',
          loadedMealId: undefined,
        });
        this.resetEditor();
        this.syncSaveEnabled({}, []);
      }
      wx.showToast({
        title: this.data.mode === 'edit' ? '餐食已更新' : '餐食已保存',
        icon: 'success',
      });
    } catch (err) {
      const message = mealApi.toUserMessage(err);
      this.setData({ saveError: message });
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ saveSubmitting: false });
      this.syncSaveEnabled({ saveSubmitting: false });
    }
  },

  onDeleteMeal() {
    if (this.data.mode !== 'edit' || !this.data.editingMealId) return;
    wx.showModal({
      title: '删除餐食',
      content: '确认删除这条餐食记录吗？删除后无法恢复。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await mealApi.deleteMeal(this.data.editingMealId as string);
          wx.showToast({ title: '已删除', icon: 'success' });
          wx.navigateBack({ delta: 1 });
        } catch (err) {
          wx.showToast({ title: mealApi.toUserMessage(err), icon: 'none' });
        }
      },
    });
  },
});
