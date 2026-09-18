import {
  Grid,
  Wallet,
  Notebook,
  User,
  EditPen,
  Management,
  Avatar,
  Star,
} from '@element-plus/icons-vue'

/**
 * 侧边栏菜单配置
 *
 * 按角色分别定义菜单项：
 *  - student    学生端：实验大厅 / 积分钱包 / 我的参与记录 / 个人中心
 *  - researcher 研究者端：发布新实验 / 实验管理 / 被试池管理 / 评分与审核
 *
 * 每项说明：
 *  - index  路由路径（与 router 中的 path 对应），点击菜单即跳转
 *  - title  菜单文案
 *  - icon   Element Plus 图标组件
 */
export const menuConfig = {
  student: [
    { index: '/student/hall', i18nKey: 'menu.hall', icon: Grid },
    // Step 12：积分钱包（PayPay 积分兑换中心）
    { index: '/student/wallet', i18nKey: 'menu.wallet', icon: Wallet },
    { index: '/student/records', i18nKey: 'menu.records', icon: Notebook },
    { index: '/student/profile', i18nKey: 'menu.profile', icon: User },
  ],
  researcher: [
    { index: '/researcher/publish', i18nKey: 'menu.publish', icon: EditPen },
    { index: '/researcher/manage', i18nKey: 'menu.manage', icon: Management },
    { index: '/researcher/pool', i18nKey: 'menu.pool', icon: Avatar },
    { index: '/researcher/review', i18nKey: 'menu.review', icon: Star },
  ],
}
