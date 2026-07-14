/**
 * Add-meal page (M2 — food catalog & portion nutrition preview).
 *
 * Scope boundary (M2): this page lets the user SEARCH or DEFINE a single food,
 * pick a portion unit + quantity, and see a live grams + nutrition preview. It
 * does NOT persist a meal and does NOT call any meal-save API. Meal saving belongs to
 * M3; the "保存这一餐" button is intentionally disabled and shows an M3 note.
 *
 * All nutrition math, search, unit merging and ad-hoc creation come from the
 * SHARED runtime (via the `food-catalog` service) — this page only holds UI
 * state, calls the service, and renders. No nutrition formulas live here.
 */
import * as foodCatalog from '../../services/food-catalog';
import type { Food, PortionUnit } from '../../services/food-catalog';

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

interface AddMealData {
  mealTypes: { key: string; label: string }[];
  selectedMealType: string; // UI-only state in M2 (not saved)
  // search
  searchQuery: string;
  searchResults: Food[];
  searchEmpty: boolean;
  // selected food
  selectedFood: Food | null;
  // custom-food form
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
  // portion
  portionUnits: PortionUnit[];
  selectedUnitIndex: number;
  quantity: string; // kept as string while editing; parsed on compute
  // preview
  preview: PreviewNumbers | null;
  previewText: PreviewText | null;
  previewError: string;
  // M3 boundary
  canSaveMeal: boolean; // always false in M2
}

Page<AddMealData, WechatMiniprogram.Page.CustomOption>({
  data: {
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
    canSaveMeal: false, // meal persistence is M3
  },

  onLoad() {
    // Start with the full catalog (empty query returns everything).
    const results = foodCatalog.searchFoods('');
    this.setData({ searchResults: results, searchEmpty: results.length === 0 });
  },

  onSelectMealType(e: WechatMiniprogram.BaseEvent) {
    const key = e.currentTarget.dataset.key as string;
    this.setData({ selectedMealType: key });
  },

  // ---- Search ----
  onSearchInput(e: WechatMiniprogram.Input) {
    const q = e.detail.value;
    const results = foodCatalog.searchFoods(q);
    this.setData({ searchQuery: q, searchResults: results, searchEmpty: results.length === 0 });
  },

  onClearSearch() {
    const results = foodCatalog.searchFoods('');
    this.setData({ searchQuery: '', searchResults: results, searchEmpty: results.length === 0 });
  },

  onSelectFood(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string;
    const food = this.data.searchResults.find((f) => f._id === id) || null;
    if (!food) return;
    this.selectFood(food);
  },

  /** Select a food, load its units, and reset quantity/preview. */
  selectFood(food: Food) {
    const units = foodCatalog.getPortionUnits(food._id);
    const def = foodCatalog.getDefaultPortionUnit(units);
    const idx = def ? units.findIndex((u) => u.label === def.label) : 0;
    this.setData({
      selectedFood: food,
      portionUnits: units,
      selectedUnitIndex: idx >= 0 ? idx : 0,
      quantity: '1',
      showCustomForm: false,
      customError: '',
    });
    this.computePreview();
  },

  // ---- Custom food form ----
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
    if (this.data.customSubmitting) return; // duplicate-tap guard
    const toNum = (s: string): number => {
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    };
    const input = {
      name: this.data.customName,
      brand: this.data.customBrand,
      category: this.data.customCategory,
      calories: toNum(this.data.customCalories),
      protein: toNum(this.data.customProtein),
      carb: toNum(this.data.customCarb),
      fat: toNum(this.data.customFat),
    };
    this.setData({ customSubmitting: true });
    try {
      const food = foodCatalog.createAdHocFood(input);
      // Refresh the list so the new ad-hoc food appears, then select it.
      const results = foodCatalog.searchFoods(this.data.searchQuery);
      this.setData({ searchResults: results });
      this.selectFood(food);
      this.setData({ showCustomForm: false, customError: '' });
      wx.showToast({ title: '已添加自定义食品', icon: 'success' });
    } catch (err) {
      this.setData({ customError: foodCatalog.toUserMessage(err) });
    } finally {
      this.setData({ customSubmitting: false });
    }
  },

  // ---- Portion ----
  onUnitChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ selectedUnitIndex: Number(e.detail.value) });
    this.computePreview();
  },

  onQuantityInput(e: WechatMiniprogram.Input) {
    this.setData({ quantity: e.detail.value });
    this.computePreview();
  },

  /** Recompute the live preview from the current food/unit/quantity. */
  computePreview() {
    const food = this.data.selectedFood;
    if (!food) {
      this.setData({ preview: null, previewText: null, previewError: '' });
      return;
    }
    const unit = this.data.portionUnits[this.data.selectedUnitIndex];
    if (!unit) {
      this.setData({ preview: null, previewText: null, previewError: '请选择份量单位' });
      return;
    }
    const q = Number(this.data.quantity);
    if (!Number.isFinite(q)) {
      // Still editing (empty / partial) — show nothing, no error yet.
      this.setData({ preview: null, previewText: null, previewError: '' });
      return;
    }
    if (q <= 0) {
      this.setData({ preview: null, previewText: null, previewError: '数量需大于 0' });
      return;
    }
    try {
      const p = foodCatalog.computePreview(food, unit, q);
      this.setData({
        preview: { grams: p.grams, ...p.nutrition },
        previewText: {
          grams: p.grams.toFixed(1),
          calories: p.nutrition.calories.toFixed(1),
          protein: p.nutrition.protein.toFixed(1),
          carb: p.nutrition.carb.toFixed(1),
          fat: p.nutrition.fat.toFixed(1),
        },
        previewError: '',
      });
    } catch (err) {
      this.setData({ preview: null, previewText: null, previewError: foodCatalog.toUserMessage(err) });
    }
  },

  // ---- M3 boundary ----
  onSave() {
    // Intentionally NOT saving. Meal persistence is M3.
    wx.showToast({ title: '餐食保存将在 M3 实现', icon: 'none' });
  },
});
