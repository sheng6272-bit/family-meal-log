import type { MealType } from '../../../shared/constants';
import type { NutritionValues } from '../../services/food-catalog';
import type { ClientMeal } from '../../services/meal';
import * as foodCatalog from '../../services/food-catalog';
import * as mealApi from '../../services/meal';
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
  display: PreviewText;
}

interface SavedMealSummary {
  mealId: string;
  date: string;
  mealTypeLabel: string;
  itemCount: number;
  totals: PreviewText;
}

interface AddMealData {
  cloudReady: boolean;
  activeProfileId?: string;
  activeProfileName: string;
  mealDate: string;
  mealTypes: { key: MealType; label: string }[];
  selectedMealType: MealType;
  searchQuery: string;
  searchResults: foodCatalog.Food[];
  searchEmpty: boolean;
  selectedFood: foodCatalog.Food | null;
  selectedFoodId: string;
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

Page<AddMealData, WechatMiniprogram.Page.CustomOption>({
  data: {
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
    searchQuery: '',
    searchResults: [],
    searchEmpty: false,
    selectedFood: null,
    selectedFoodId: '',
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
    saveSubmitting: false,
    saveEnabled: false,
    saveError: '',
    lastSavedSummary: null,
  },

  onLoad() {
    this.refreshSearch('');
  },

  onShow() {
    this.refreshSessionState();
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
  },

  onDateChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ mealDate: e.detail.value as string });
  },

  onSelectMealType(e: WechatMiniprogram.BaseEvent) {
    const key = e.currentTarget.dataset.key as MealType;
    this.setData({ selectedMealType: key });
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

  selectFood(food: foodCatalog.Food) {
    const units = foodCatalog.getPortionUnits(food._id);
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
      this.setData({ preview: null, previewText: null, previewError: '数量需大于 0' });
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

  buildDraftItem(): DraftMealItem {
    const food = this.data.selectedFood;
    const unit = this.data.portionUnits[this.data.selectedUnitIndex];
    const preview = this.data.preview;
    if (!food || !unit || !preview) {
      throw new Error('请先选择食品并完成份量预览');
    }
    const quantity = Number(this.data.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('数量需大于 0');
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

  resetEditor(nextRequestId?: string) {
    this.setData({
      selectedFood: null,
      selectedFoodId: '',
      portionUnits: [],
      selectedUnitIndex: 0,
      quantity: '1',
      preview: null,
      previewText: null,
      previewError: '',
      editingItemIndex: -1,
      currentRequestId: nextRequestId || this.data.currentRequestId,
    });
  },

  onUpsertDraftItem() {
    try {
      const nextItem = this.buildDraftItem();
      const nextItems = this.data.draftItems.slice();
      const editingIndex = this.data.editingItemIndex;
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
      wx.showToast({ title: editingIndex >= 0 ? '已更新条目' : '已加入本餐', icon: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加失败，请重试';
      this.setData({ previewError: message });
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  onEditDraftItem(e: WechatMiniprogram.BaseEvent) {
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.draftItems[index];
    if (!item) return;
    const portionUnits = foodCatalog.getPortionUnits(item.food._id);
    const selectedUnitIndex = Math.max(
      portionUnits.findIndex((unit) => unit.label === item.portionLabel),
      0,
    );
    this.setData({
      selectedFood: item.food,
      selectedFoodId: item.food._id || '',
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

  async onSave() {
    if (this.data.saveSubmitting) return;
    if (!this.data.cloudReady) {
      wx.showToast({ title: '当前离线，无法保存到云端', icon: 'none' });
      return;
    }
    if (!this.data.activeProfileId) {
      wx.showToast({ title: '请先选择家庭成员', icon: 'none' });
      return;
    }
    if (this.data.draftItems.length === 0) {
      wx.showToast({ title: '请先添加至少一项食品', icon: 'none' });
      return;
    }

    this.setData({ saveSubmitting: true, saveError: '' });
    this.syncSaveEnabled({ saveSubmitting: true });

    try {
      const created = await mealApi.createMeal({
        requestId: this.data.currentRequestId,
        familyProfileId: this.data.activeProfileId,
        date: this.data.mealDate,
        mealType: this.data.selectedMealType,
        items: this.data.draftItems.map((item) => ({
          food: item.food,
          quantity: item.quantity,
          portionLabel: item.portionLabel,
        })),
      });
      const reloaded = await mealApi.getMeal(created._id);
      const nextRequestId = mealApi.newMealRequestId();
      this.setData({
        draftItems: [],
        draftTotalText: null,
        lastSavedSummary: buildSavedMealSummary(reloaded),
        currentRequestId: nextRequestId,
      });
      this.resetEditor(nextRequestId);
      this.syncSaveEnabled({}, []);
      wx.showToast({ title: '餐食已保存', icon: 'success' });
    } catch (err) {
      const message = mealApi.toUserMessage(err);
      this.setData({ saveError: message });
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ saveSubmitting: false });
      this.syncSaveEnabled({ saveSubmitting: false });
    }
  },
});
