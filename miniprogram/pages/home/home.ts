/**
 * Home page (M1).
 * Shows the active family profile, today's date, daily totals placeholder, and
 * entry points to manage profiles / create the first profile. The add-meal
 * placeholder is retained (meal logging is a later milestone).
 */
import type { MealType } from '../../../shared/constants';
import type { NutritionValues } from '../../../shared/types';
import type { ClientProfile } from '../../services/profile';
import { loadSession, selectActiveProfile } from '../../services/session';

interface HomeData {
  today: string;
  cloudReady: boolean;
  activeProfile?: ClientProfile;
  activeProfileLabel: string;
  needsOnboarding: boolean;
  dailyTotals: NutritionValues;
  mealTypes: { key: MealType; label: string }[];
}

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const ERROR_TEXT: Record<string, string> = {
  cloud_not_configured: '未配置云环境，功能不可用',
  cloud_not_ready: '未配置云环境，功能不可用',
  login_failed: '登录失败，请重试',
  no_openid_context: '登录失败，请重试',
  list_failed: '成员列表加载失败',
  session_failed: '加载失败，请重试',
};

Page<HomeData, WechatMiniprogram.Page.CustomOption>({
  data: {
    today: todayIso(),
    cloudReady: false,
    activeProfile: undefined,
    activeProfileLabel: '未选择成员',
    needsOnboarding: false,
    dailyTotals: { calories: 0, protein: 0, carb: 0, fat: 0 },
    mealTypes: [
      { key: 'breakfast', label: '早餐' },
      { key: 'lunch', label: '午餐' },
      { key: 'dinner', label: '晚餐' },
      { key: 'snack', label: '加餐' },
    ],
  },

  onShow() {
    const app = getApp<IAppOption>();
    this.refresh(app);
  },

  async refresh(app: IAppOption) {
    this.setData({ cloudReady: app.globalData.cloudReady });
    if (app.globalData.cloudReady) {
      const res = await loadSession(app);
      if (!res.ok) {
        wx.showToast({ title: ERROR_TEXT[res.reason || ''] || '加载失败，请重试', icon: 'none' });
        return;
      }
    }
    const profiles = app.globalData.profiles;
    const activeId = app.globalData.activeFamilyProfileId;
    const active = profiles.find((p) => p._id === activeId);
    this.setData({
      needsOnboarding: app.globalData.cloudReady && profiles.length === 0,
      activeProfile: active,
      activeProfileLabel: active
        ? active.name
        : profiles.length === 0
          ? '还没有家庭成员'
          : '未选择成员',
    });
  },

  onManageProfiles() {
    wx.navigateTo({ url: '/pages/profiles/profiles' });
  },

  onCreateFirst() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit?mode=create' });
  },

  onSelectActive(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string;
    const app = getApp<IAppOption>();
    selectActiveProfile(app, id);
    this.refresh(app);
  },

  onAddMeal() {
    wx.navigateTo({ url: '/pages/add-meal/add-meal' });
  },
});
