/**
 * Home page (placeholder shell).
 * Shows the active family profile, today's date and daily totals. In this
 * foundation task the data is placeholder-only; the manual-logging data flow
 * is implemented in a later milestone.
 */
import type { MealType } from '../../../shared/constants';
import type { NutritionValues } from '../../../shared/types';

interface HomeData {
  today: string;
  activeProfileName: string;
  dailyTotals: NutritionValues;
  mealTypes: { key: MealType; label: string }[];
  cloudReady: boolean;
}

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

Page<HomeData, WechatMiniprogram.Page.CustomOption>({
  data: {
    today: todayIso(),
    activeProfileName: '未选择成员',
    dailyTotals: { calories: 0, protein: 0, carb: 0, fat: 0 },
    mealTypes: [
      { key: 'breakfast', label: '早餐' },
      { key: 'lunch', label: '午餐' },
      { key: 'dinner', label: '晚餐' },
      { key: 'snack', label: '加餐' },
    ],
    cloudReady: false,
  },

  onShow() {
    const app = getApp<IAppOption>();
    this.setData({ cloudReady: app.globalData.cloudReady });
  },

  onAddMeal() {
    wx.navigateTo({ url: '/pages/add-meal/add-meal' });
  },
});
