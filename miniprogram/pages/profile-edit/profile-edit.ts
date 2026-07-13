/**
 * Profile edit page (M1).
 * Create/edit form for a single family profile (name + relation). Validation
 * happens both here (fast feedback) and server-side (trust). Submitting is
 * guarded so a duplicate tap cannot create two profiles.
 */
import type { ProfileInput } from '../../services/profile';
import { createProfile, updateProfile } from '../../services/profile';
import { loadSession, selectActiveProfile } from '../../services/session';
import { RELATION_OPTIONS } from '../../config/labels';

interface EditData {
  mode: 'create' | 'edit';
  profileId?: string;
  name: string;
  relationIndex: number;
  relationOptions: { value: FamilyRelation; label: string }[];
  submitting: boolean;
  cloudReady: boolean;
}

Page<EditData, WechatMiniprogram.Page.CustomOption>({
  data: {
    mode: 'create',
    profileId: undefined,
    name: '',
    relationIndex: 0,
    relationOptions: RELATION_OPTIONS,
    submitting: false,
    cloudReady: false,
  },

  onLoad(options: Record<string, string>) {
    const app = getApp<IAppOption>();
    const mode = options.mode === 'edit' ? 'edit' : 'create';
    this.setData({
      cloudReady: app.globalData.cloudReady,
      mode,
      profileId: options.id,
    });
    if (mode === 'edit' && options.id) {
      const existing = app.globalData.profiles.find((p) => p._id === options.id);
      if (existing) {
        this.setData({
          name: existing.name,
          relationIndex: RELATION_OPTIONS.findIndex((o) => o.value === existing.relation),
        });
      }
    }
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ name: e.detail.value });
  },

  onRelationChange(e: WechatMiniprogram.PickerChange) {
    this.setData({ relationIndex: Number(e.detail.value) });
  },

  async onSubmit() {
    if (this.data.submitting) return; // duplicate-tap guard
    const name = this.data.name.trim();
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    const relation = this.data.relationOptions[this.data.relationIndex].value;
    const input: ProfileInput = { name, relation };

    this.setData({ submitting: true });
    try {
      const app = getApp<IAppOption>();
      if (this.data.mode === 'edit' && this.data.profileId) {
        await updateProfile(this.data.profileId, input);
      } else {
        const created = await createProfile(input);
        // New profile becomes the active one for this session.
        selectActiveProfile(app, created._id);
      }
      await loadSession(app); // refresh globalData (default, list, active)
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 350);
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.startsWith('invalid_input')) {
        wx.showToast({ title: `输入无效：${msg.split(':')[1] || ''}`, icon: 'none' });
      } else {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  onCancel() {
    wx.navigateBack();
  },
});
