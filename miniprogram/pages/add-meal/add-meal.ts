/**
 * Add-meal page (placeholder shell).
 * The primary, always-available workflow is MANUAL entry. AI assistance is an
 * optional add-on wired through the provider-neutral adapter and is disabled
 * (mock only) in this foundation task.
 */
import type { MealType } from '../../../shared/constants';

interface AddMealData {
  mealTypes: { key: MealType; label: string }[];
  selectedMealType: MealType;
  aiEnabled: boolean;
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
    // AI is intentionally off in the foundation; manual entry is the source of truth.
    aiEnabled: false,
  },

  onSelectMealType(e: WechatMiniprogram.BaseEvent) {
    const key = e.currentTarget.dataset.key as MealType;
    this.setData({ selectedMealType: key });
  },

  onAddManualItem() {
    wx.showToast({ title: '手动添加将在后续里程碑实现', icon: 'none' });
  },

  onSave() {
    wx.showToast({ title: '保存功能将在后续里程碑实现', icon: 'none' });
  },
});
