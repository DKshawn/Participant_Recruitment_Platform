/**
 * 实验 Mock 数据（Step 15：JSONB 多语言结构，对齐真实后端）
 *
 * 字段说明（多语言字段统一为 { zh, ja, en } 对象，匹配后端 JSONB 列）：
 *  - id                        实验唯一标识
 *  - code                      实验编号（用于展示）
 *  - title                     实验标题（多语言对象：{zh, ja, en}）
 *  - description               实验描述（多语言对象：{zh, ja, en}）
 *  - location_type             参与方式类型：'online' 线上 | 'offline' 线下（实验室）
 *  - location_detail           具体地点：线下 = 楼宇/房间号；线上 = 实验链接
 *  - required_items            需携带物品（多语言对象：{zh, ja, en}）
 *  - reward_points             报酬（单位：积分，Step 12 起 1 积分 = 1 日元；数值，便于排序/判断高报酬）
 *  - duration_minutes          预计耗时（分钟，数值）
 *  - min_reputation_required   【核心】最低信誉分要求：
 *                              仅当「学生信誉分 >= 该值」时，此实验对学生可见
 *  - tags                      学科/主题标签：预定义标签存 i18n 稳定 key（如
 *                              'behavioralEconomics'），学生端按界面语言翻译；
 *                              自由文本（如 '基线测试'）模拟研究者自创标签，原样展示
 *
 * 设计意图：门槛从 0 到 99 拉开梯度。
 * 当登录学生信誉分 = 95 时：exp_005(98)、exp_006(99) 将被前端过滤隐藏，
 * 从而直观验证「定向分发」机制。
 *
 * 渲染约定：多语言字段由视图侧 pickLocalized() 按当前界面语言择优
 * （当前语言 → zh → en → ja），学生切换界面语言时卡片文案实时切换。
 */
export const mockExperiments = [
  {
    id: 'exp_001',
    code: 'TDC-2026-04',
    title: {
      zh: '跨期决策行为实验',
      ja: '異時点間選択行動実験',
      en: 'Intertemporal Choice Experiment',
    },
    description: {
      zh: '在一系列“现在拿少量 / 未来拿较多”的选择中，测量你的时间偏好与耐心水平。任务轻松，认真作答即可。',
      ja: '「今少しを得るか、未来で多くを得るか」の一連の選択を通じて、時間選好と忍耐の程度を測定します。タスクは軽量で、丁寧に回答いただくだけで結構です。',
      en: 'A series of "small amount now vs. larger amount later" choices to measure your time preference and patience. The task is light; careful answering is all that is required.',
    },
    location_type: 'offline',
    location_detail: 'F301',
    required_items: {
      zh: '学生证、笔记本电脑',
      ja: '学生証、ノートPC',
      en: 'Student ID, laptop',
    },
    reward_points: 2000,
    duration_minutes: 30,
    min_reputation_required: 60,
    tags: ['behavioralEconomics', 'decisionScience'],
  },
  {
    id: 'exp_002',
    code: 'ATT-2026-11',
    title: {
      zh: '注意力与反应时任务',
      ja: '注意と反応時間タスク',
      en: 'Attention & Reaction-Time Task',
    },
    description: {
      zh: '完成一组视觉搜索与反应时任务，用于基线认知能力校准，任务轻松。',
      ja: '視覚探索と反応時間の一連のタスクを行い、基礎的な認知能力の基準合わせ（キャリブレーション）に使用します。タスクは軽量です。',
      en: 'A visual search and reaction-time battery used to calibrate baseline cognitive performance. The task is light.',
    },
    location_type: 'online',
    location_detail: 'https://actmind.tus.ac.jp/lab/att-2026-11',
    required_items: {
      zh: '稳定的网络连接、安静的环境',
      ja: '安定したネット接続、静かな環境',
      en: 'Stable internet connection, quiet environment',
    },
    reward_points: 1200,
    duration_minutes: 20,
    min_reputation_required: 0,
    tags: ['cognitivePsychology', '基线测试'],
  },
  {
    id: 'exp_003',
    code: 'ULT-2026-07',
    title: {
      zh: '最后通牒博弈实验',
      ja: '最後通牒ゲーム実験',
      en: 'Ultimatum Game Experiment',
    },
    description: {
      zh: '与匿名同伴进行资源分配博弈，研究公平偏好与策略性出价行为。',
      ja: '匿名の相手との資源配分ゲームを通じて、公平性への選好と戦略的なオファー行動を研究します。',
      en: 'Resource-splitting games with anonymous partners to study fairness preferences and strategic offers.',
    },
    location_type: 'online',
    location_detail: 'https://actmind.tus.ac.jp/lab/ult-2026-07',
    required_items: {
      zh: '笔记本电脑或台式机（需 Chrome 浏览器）',
      ja: 'ノートPCまたはデスクトップ（Chrome 必須）',
      en: 'Laptop or desktop (Chrome required)',
    },
    reward_points: 1500,
    duration_minutes: 25,
    min_reputation_required: 70,
    tags: ['gameTheory', 'socialPreferences'],
  },
  {
    id: 'exp_004',
    code: 'PGP-2026-09',
    title: {
      zh: '公共品博弈（高报酬）',
      ja: '公共財ゲーム（高報酬）',
      en: 'Public Goods Game (High Reward)',
    },
    description: {
      zh: '多人重复贡献决策，研究合作、惩罚与信任的形成机制。报酬较高，要求全程专注。',
      ja: '複数人の反復貢献ゲームにより、協力・制裁・信頼の形成メカニズムを研究します。報酬は高めですが、終始集中を要します。',
      en: 'Repeated contribution decisions in groups to study the formation of cooperation, punishment, and trust. High reward; sustained attention required.',
    },
    location_type: 'offline',
    location_detail: 'B210',
    required_items: {
      zh: '学生证（入场核验）',
      ja: '学生証（入室確認用）',
      en: 'Student ID (for entry check)',
    },
    reward_points: 5000,
    duration_minutes: 45,
    min_reputation_required: 90,
    tags: ['cooperation', '高报酬'],
  },
  {
    id: 'exp_005',
    code: 'LON-2026-02',
    title: {
      zh: '严格质量·纵向追踪实验',
      ja: '厳格品質・縦断追跡実験',
      en: 'Strict-Quality Longitudinal Study',
    },
    description: {
      zh: '面向高质量数据的长期纵向研究，包含多轮严谨问卷与行为任务，数据用于论文。',
      ja: '高品質なデータを目的とした長期縦断研究。複数回の厳密な質問紙と行動課題が含まれ、データは論文に使用されます。',
      en: 'A long-term longitudinal study targeting high-quality data: multiple rigorous questionnaires and behavioral tasks; data used in publications.',
    },
    location_type: 'offline',
    location_detail: 'C405',
    required_items: {
      zh: '学生证、笔和纸（问卷环节）',
      ja: '学生証、ボールペンとメモ用紙（質問紙环节用）',
      en: 'Student ID, pen and paper (for questionnaire stages)',
    },
    reward_points: 8000,
    duration_minutes: 60,
    min_reputation_required: 98,
    tags: ['longitudinal', '高质量要求'],
  },
  {
    id: 'exp_006',
    code: 'NEU-2026-01',
    title: {
      zh: '专家级神经行为联合实验',
      ja: '専門家向け神経行動統合実験',
      en: 'Expert-Level Neurobehavioral Study',
    },
    description: {
      zh: '结合眼动与行为反应的高门槛研究，仅对信誉分顶尖、历史表现稳定的被试开放。',
      ja: '視線追跡と行動反応を統合した高基準の研究。信用スコアが上位で、過去の成績が安定している被験者のみ参加可能です。',
      en: 'A high-bar study combining eye-tracking and behavioral responses, open only to top-reputation participants with stable track records.',
    },
    location_type: 'offline',
    location_detail: 'A101 (Neuro Lab)',
    required_items: {
      zh: '学生证；设备由实验室提供，请勿携带电子设备',
      ja: '学生証。設備は実験室側で用意。電子機器の持ち込みはご遠慮ください',
      en: 'Student ID; equipment provided in-lab, please do not bring electronic devices',
    },
    reward_points: 12000,
    duration_minutes: 90,
    min_reputation_required: 99,
    tags: ['neuroscience', '顶级门槛'],
  },
]
