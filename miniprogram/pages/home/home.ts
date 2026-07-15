import type { MealType } from '../../../shared/constants';
import type { NutritionValues } from '../../../shared/types';
import type { ClientProfile } from '../../services/profile';
import type { ClientMeal } from '../../services/meal';
import { loadSession } from '../../services/session';
import * as mealApi from '../../services/meal';

interface HomeMealSummary {
  mealId: string;
  mealType: MealType;
  mealTypeLabel: string;
  itemCount: number;
  totalsText: string;
  note?: string;
  hasPhoto: boolean;
  isAiAssisted: boolean;
}

interface HomeData {
  today: string;
  selectedDate: string;
  cloudReady: boolean;
  activeProfile: ClientProfile | null;
  activeProfileLabel: string;
  needsOnboarding: boolean;
  dailyTotals: NutritionValues;
  dailyMeals: HomeMealSummary[];
  historyLoading: boolean;
  historyError: string;
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

const EMPTY_TOTALS: NutritionValues = { calories: 0, protein: 0, carb: 0, fat: 0 };

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function mealSummary(meal: ClientMeal): HomeMealSummary {
  return {
    mealId: meal._id,
    mealType: meal.mealType,
    mealTypeLabel: MEAL_TYPE_LABELS[meal.mealType],
    itemCount: meal.items.length,
    totalsText: `${meal.totals.calories.toFixed(1)} kcal · 蛋白质 ${meal.totals.protein.toFixed(1)}g · 碳水 ${meal.totals.carb.toFixed(1)}g · 脂肪 ${meal.totals.fat.toFixed(1)}g`,
    note: meal.note,
    hasPhoto: !!meal.photoFileId,
    isAiAssisted: meal.source === 'ai_assisted',
  };
}

const ERROR_TEXT: Record<string, string> = {
  cloud_not_configured: '云开发尚未配置，当前只能查看本地页面。',
  cloud_not_ready: '云开发尚未就绪，请稍后重试。',
  login_failed: '登录失败，请稍后重试。',
  no_openid_context: '登录上下文缺失，请重新进入小程序。',
  list_failed: '加载餐食记录失败，请稍后重试。',
  session_failed: '加载家庭成员失败，请稍后重试。',
};

Page<HomeData, WechatMiniprogram.Page.CustomOption>({
  data: {
    today: todayIso(),
    selectedDate: todayIso(),
    cloudReady: false,
    activeProfile: null,
    activeProfileLabel: '未选择成员',
    needsOnboarding: false,
    dailyTotals: EMPTY_TOTALS,
    dailyMeals: [],
    historyLoading: false,
    historyError: '',
  },

  onShow() {
    const app = getApp<IAppOption>();
    void this.refresh(app);
  },

  async refresh(app: IAppOption) {
    this.setData({ cloudReady: app.globalData.cloudReady });
    if (app.globalData.cloudReady) {
      const res = await loadSession(app);
      if (!res.ok) {
        wx.showToast({
          title: ERROR_TEXT[res.reason || ''] || '加载会话失败，请稍后重试。',
          icon: 'none',
        });
        return;
      }
    }

    const profiles = app.globalData.profiles || [];
    const activeId = app.globalData.activeFamilyProfileId;
    const active = profiles.find((profile) => profile._id === activeId);

    this.setData({
      needsOnboarding: app.globalData.cloudReady && profiles.length === 0,
      activeProfile: active || null,
      activeProfileLabel: active
        ? active.name
        : profiles.length === 0
          ? '还没有家庭成员'
          : '未选择成员',
    });

    if (!app.globalData.cloudReady || !active?._id) {
      this.setData({
        dailyTotals: EMPTY_TOTALS,
        dailyMeals: [],
        historyError: '',
        historyLoading: false,
      });
      return;
    }

    await this.refreshHistory(active._id, this.data.selectedDate);
  },

  async refreshHistory(profileId: string, date: string) {
    this.setData({ historyLoading: true, historyError: '' });
    try {
      const result = await mealApi.listMeals(profileId, date);
      this.setData({
        dailyTotals: result.totals,
        dailyMeals: result.meals.map(mealSummary),
        historyLoading: false,
        historyError: '',
      });
    } catch (err) {
      this.setData({
        historyLoading: false,
        historyError: mealApi.toUserMessage(err),
        dailyTotals: EMPTY_TOTALS,
        dailyMeals: [],
      });
    }
  },

  onDateChange(e: WechatMiniprogram.PickerChange) {
    const selectedDate = e.detail.value as string;
    this.setData({ selectedDate });
    if (this.data.cloudReady && this.data.activeProfile?._id) {
      void this.refreshHistory(this.data.activeProfile._id, selectedDate);
    }
  },

  onManageProfiles() {
    wx.navigateTo({ url: '/pages/profiles/profiles' });
  },

  onCreateFirst() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit?mode=create' });
  },

  onAddMeal() {
    wx.navigateTo({ url: '/pages/add-meal/add-meal' });
  },

  onOpenLibrary() {
    wx.navigateTo({ url: '/pages/library/library' });
  },

  onEditMeal(e: WechatMiniprogram.BaseEvent) {
    const mealId = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/add-meal/add-meal?mealId=${mealId}` });
  },

  onDeleteMeal(e: WechatMiniprogram.BaseEvent) {
    const mealId = e.currentTarget.dataset.id as string;
    wx.showModal({
      title: '删除餐食',
      content: '确认删除这条餐食记录吗？删除后当天汇总会同步更新。',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await mealApi.deleteMeal(mealId);
          wx.showToast({ title: '已删除', icon: 'success' });
          if (this.data.activeProfile?._id) {
            await this.refreshHistory(this.data.activeProfile._id, this.data.selectedDate);
          }
        } catch (err) {
          wx.showToast({ title: mealApi.toUserMessage(err), icon: 'none' });
        }
      },
    });
  },
});
