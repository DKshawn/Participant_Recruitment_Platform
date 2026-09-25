/**
 * 被试库 Mock 数据（单一数据源）
 *
 * 说明：
 *  - reputation     隐藏信誉分（0~100，默认约 100 起），【对学生端绝不展示具体数值】
 *  - totalReward    累计已获报酬（单位：积分，Step 12 起 1 积分 = 1 日元）
 *  - avgDuration    平均完成耗时（单个已参与实验的平均用时，用于被试池表格展示）
 *  - reputationLog  信誉分变动日志（研究者在「评分与审核」中产生，此处预置几条演示）
 *  - participations 参与记录（报名/完成/信誉分变动，供「我的参与记录」与审核使用）
 *
 * 三个学生的初始信誉分刻意拉开差距（95 / 78 / 52），
 * 方便在「实验大厅」用不同身份登录，直观验证「定向分发 / 信誉分过滤」效果。
 *
 * 【Step 13 学术语境本地化】：
 *  - 专业/年级不再写死中文，改为存储 i18n 键值路径（majorKey / gradeKey），
 *    视图侧统一以 `$t(majorKey) · $t(gradeKey)` 动态翻译，
 *    译文符合各国真实学术习惯（学部1年 / 1st-Year (Freshman) / 大一…）。
 *
 * 【Step 16 姓名多语言化】：
 *  - name 由单字符串升级为 { zh, ja, en } 多语言对象，视图侧以 pickLocalized() 择优渲染；
 *  - 命名规范：中文名→日语用片假名注音、英语用拼音；
 *    日文名→中文保留汉字、英语用罗马音；欧美名→中文汉字音译、日语片假名、英语原名。
 *  - 名册刻意覆盖「中国 / 日本 / 欧美」三种命名规范，便于验证各语言下的姓名渲染。
 */
export const mockSubjects = [
  {
    id: 'stu_001',
    name: { zh: '陈默', ja: 'チェン・モー', en: 'Chen Mo' },
    majorKey: 'majors.psychology', // Step 13：专业存 i18n key（心理学）
    gradeKey: 'grades.year2', // 年级存 i18n key（大二 / 学部2年 / 2nd-Year）
    reputation: 95, // 当前模拟登录学生，隐藏信誉分 = 95
    totalReward: 8600,
    avgDuration: 32, // 平均完成耗时（分钟，数字；展示时由视图拼接本地化单位）
    joinedAt: '2025-09-01',
    reputationLog: [
      {
        id: 'log_s1_1',
        delta: 5,
        reason: '通过全部注意力测试，作答认真、无随机乱点',
        operator: '顾言',
        time: '2026-08-12T09:30:00Z',
      },
      {
        id: 'log_s1_2',
        delta: -3,
        reason: '第 7 组题目疑似随机作答，酌情扣减',
        operator: '顾言',
        time: '2026-07-20T14:00:00Z',
      },
    ],
    participations: [
      {
        id: 'part_s1_1',
        experimentId: 'exp_hist_1',
        experimentName: '风险偏好测量实验',
        experimentTitle: { zh: '风险偏好测量实验', ja: 'リスク選好測定実験', en: 'Risk Preference Measurement Experiment' },
        reward: 1500,
        status: '已完成',
        enrolledAt: '2026-06-10T03:00:00Z',
        reputationDelta: 5,
        reviewed: true,
      },
    ],
  },
  {
    id: 'stu_002',
    name: { zh: '田中太郎', ja: '田中太郎', en: 'Taro Tanaka' },
    majorKey: 'majors.economics', // 经济学
    gradeKey: 'grades.year3', // 大三
    reputation: 78,
    totalReward: 5200,
    avgDuration: 41, // 分钟
    joinedAt: '2025-11-18',
    reputationLog: [
      {
        id: 'log_s2_1',
        delta: -5,
        reason: '中途多次离开实验窗口，完成度不足',
        operator: '沈知',
        time: '2026-08-02T08:15:00Z',
      },
    ],
    participations: [
      {
        id: 'part_s2_1',
        experimentId: 'exp_hist_2',
        experimentName: '跨期决策行为实验',
        experimentTitle: { zh: '跨期决策行为实验', ja: '異時点間選択行動実験', en: 'Intertemporal Choice Experiment' },
        reward: 2000,
        status: '已完成',
        enrolledAt: '2026-05-28T05:20:00Z',
        reputationDelta: -5,
        reviewed: true,
      },
    ],
  },
  {
    id: 'stu_003',
    name: { zh: '爱丽丝', ja: 'アリス', en: 'Alice' },
    majorKey: 'majors.sociology', // 社会学
    gradeKey: 'grades.year1', // 大一
    reputation: 52,
    totalReward: 1800,
    avgDuration: 19, // 分钟
    joinedAt: '2026-03-05',
    reputationLog: [
      {
        id: 'log_s3_1',
        delta: -8,
        reason: '未通过注意力检查，且出现明显随机乱点',
        operator: '顾言',
        time: '2026-07-15T10:00:00Z',
      },
    ],
    participations: [
      {
        id: 'part_s3_1',
        experimentId: 'exp_hist_3',
        experimentName: '注意力与反应时任务',
        experimentTitle: { zh: '注意力与反应时任务', ja: '注意と反応時間タスク', en: 'Attention & Reaction-Time Task' },
        reward: 800,
        status: '已淘汰',
        enrolledAt: '2026-06-02T06:40:00Z',
        reputationDelta: -8,
        reviewed: true,
      },
    ],
  },
]
