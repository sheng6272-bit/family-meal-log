/**
 * Profiles page (M1).
 * Lists the caller's family profiles, lets the user select the active profile,
 * set a default, and create/edit profiles. All writes go through the
 * server-trusted profileApi cloud function.
 */
import type { ClientProfile } from '../../services/profile';
import { setDefaultProfile } from '../../services/profile';
import { loadSession, selectActiveProfile } from '../../services/session';
import { RELATION_LABELS } from '../../config/labels';

interface ProfileRow extends ClientProfile {
  relationLabel: string;
  isDefault: boolean;
}

interface ProfilesData {
  cloudReady: boolean;
  profiles: ProfileRow[];
  activeFamilyProfileId?: string;
  submitting: boolean;
}

const ERROR_TEXT: Record<string, string> = {
  cloud_not_configured: '未配置云环境，功能不可用',
  list_failed: '成员列表加载失败',
  set_default_failed: '设置默认失败',
  session_failed: '加载失败，请重试',
};

Page<ProfilesData, WechatMiniprogram.Page.CustomOption>({
  data: {
    cloudReady: false,
    profiles: [],
    activeFamilyProfileId: undefined,
    submitting: false,
  },

  onShow() {
    const app = getApp<IAppOption>();
    this.setData({ cloudReady: app.globalData.cloudReady });
    if (app.globalData.cloudReady) this.load();
  },

  async load() {
    const app = getApp<IAppOption>();
    const res = await loadSession(app);
    if (!res.ok) {
      wx.showToast({ title: ERROR_TEXT[res.reason || ''] || '加载失败，请重试', icon: 'none' });
      return;
    }
    this.render(app);
  },

  render(app: IAppOption) {
    const defaultId = app.globalData.defaultFamilyProfileId;
    const activeId = app.globalData.activeFamilyProfileId;
    const rows: ProfileRow[] = (app.globalData.profiles || []).map((p) => ({
      ...p,
      relationLabel: RELATION_LABELS[p.relation],
      isDefault: p._id === defaultId,
    }));
    this.setData({
      profiles: rows,
      activeFamilyProfileId: activeId,
    });
  },

  onSelect(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string;
    const app = getApp<IAppOption>();
    selectActiveProfile(app, id);
    this.render(app);
    wx.showToast({ title: '已切换当前成员', icon: 'success' });
  },

  async onSetDefault(e: WechatMiniprogram.BaseEvent) {
    if (this.data.submitting) return; // duplicate-tap guard
    const id = e.currentTarget.dataset.id as string;
    this.setData({ submitting: true });
    try {
      await setDefaultProfile(id);
      const app = getApp<IAppOption>();
      app.globalData.defaultFamilyProfileId = id;
      this.render(app);
      wx.showToast({ title: '已设为默认', icon: 'success' });
    } catch {
      wx.showToast({ title: ERROR_TEXT.set_default_failed, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit?mode=create' });
  },

  onEdit(e: WechatMiniprogram.BaseEvent) {
    const id = e.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/profile-edit/profile-edit?mode=edit&id=${id}` });
  },
});
