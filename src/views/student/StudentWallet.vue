<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Wallet, Link as LinkIcon, CreditCard } from '@element-plus/icons-vue'
import { api, apiEnabled } from '@/services/api'

/**
 * 学生端：积分钱包（Step 12：积分系统与 PayPay 积分兑换页）
 *
 * 业务规则（Step 12 重大变更）：
 *  - 系统中所有「报酬」由 日元(JPY) 改为 积分(Points)；
 *  - 汇率：1 积分 = 1 日元（1 ポイント = 1 円）；
 *  - 最低兑换门槛：1000 积分；
 *  - 主要提现渠道：PayPay。
 *
 * 页面三区块：
 *  A. 资产总览卡片   —— 醒目展示可用积分（Mock：1500）+ 汇率副标题
 *  B. PayPay 兑换表单 —— 账户绑定状态（未绑定 → setTimeout 1s 模拟授权成功）
 *                        + 金额输入（步长 100，校验 >= 1000 且 <= 余额）
 *                        + 二次确认框 + 确认兑换按钮（条件禁用）
 *  C. 兑换历史记录   —— 表格：申请时间 / 兑换积分 / 状态（处理中·已到账）/ 渠道
 *
 * i18n：全部文案走 wallet.* 字典（zh-CN / en-US / ja-JP），实时切换。
 * 纯前端 Mock：余额、绑定状态、历史记录均存于组件内 ref，不做真实网络请求。
 */
const { t, locale } = useI18n()

/* ---------------------- 常量与 Mock 数据 ---------------------- */

/** 最低兑换门槛（业务规则：1000 积分） */
const MIN_EXCHANGE = 1000

/** 已绑定 PayPay 的脱敏账号（Mock，绑定成功后展示） */
const BOUNDED_ACCOUNT = '090-****-1234'

/** 区块 A：当前可用积分（Mock） */
const balance = ref(apiEnabled ? 0 : 1500)
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const ledger = ref([])
const requestKey = ref(crypto.randomUUID())
async function load() {
  if (!apiEnabled) return
  loading.value = true
  loadError.value = ''
  try {
    const wallet = await api('/wallet')
    balance.value = wallet.balance
    historyList.value = wallet.history
    ledger.value = wallet.ledger
  } catch (error) { loadError.value = error.message }
  finally { loading.value = false }
}
onMounted(load)

/** 区块 B：PayPay 绑定状态（Mock：初始未绑定） */
const isPayPayBound = ref(false)
/** 绑定授权进行中标记（setTimeout 模拟 1 秒授权跳转） */
const binding = ref(false)

/** 区块 B：兑换金额输入值 */
const amount = ref(null)
watch(amount, () => { requestKey.value = crypto.randomUUID() })

/** 区块 C：兑换历史记录（Mock 2-3 条；新兑换成功时 unshift 到最前） */
const historyList = ref(apiEnabled ? [] : [
  {
    id: 'ex_20260211',
    time: new Date('2026-02-11T14:32:00'),
    amount: 2000,
    status: 'done', // 'done' = 已到账
    channel: 'PayPay',
  },
  {
    id: 'ex_20260128',
    time: new Date('2026-01-28T09:15:00'),
    amount: 1500,
    status: 'done',
    channel: 'PayPay',
  },
  {
    id: 'ex_20260110',
    time: new Date('2026-01-10T18:47:00'),
    amount: 3000,
    status: 'processing', // 'processing' = 处理中
    channel: 'PayPay',
  },
])

/* ---------------------- 派生状态 ---------------------- */

/**
 * 金额校验错误信息（响应式）：
 *  - 空值 / 低于 1000 → 红色提示「最低兑换额为 1000 积分」
 *  - 超过当前可用积分 → 红色提示「兑换金额不能超过当前可用积分」
 *  - 合法时返回空字符串（隐藏提示）
 * 注意：不依赖 el-input-number 的 min 属性做拦截，
 * 而是手动校验，以便在输入框下方渲染 i18n 红字提示。
 */
const amountError = computed(() => {
  const a = amount.value
  if (a == null || a < MIN_EXCHANGE) return t('wallet.amountMinError')
  if (a > balance.value) return t('wallet.amountMaxError')
  return ''
})

/**
 * 确认兑换按钮的可用条件（任一不满足即禁用）：
 *  1) 必须已绑定 PayPay；
 *  2) 金额必须合法（>= 1000 且 <= 余额，由 amountError 统一判定）。
 */
const canExchange = computed(
  () => (apiEnabled || isPayPayBound.value) && amount.value != null && !amountError.value && amount.value % 100 === 0 && !loading.value && !loadError.value && !submitting.value,
)

/* ---------------------- 行为动作 ---------------------- */

/**
 * 绑定 PayPay（Mock）：
 * 点击后进入「授权中…」加载态，setTimeout 模拟 1 秒后的授权成功跳转，
 * 随后绑定状态翻转为已绑定并提示成功。
 */
function bindPayPay() {
  binding.value = true
  setTimeout(() => {
    binding.value = false
    isPayPayBound.value = true
    ElMessage.success(t('wallet.bindSuccess'))
  }, 1000)
}

/**
 * 确认兑换（含二次确认框）：
 *  ElMessageBox 弹出「确认将 N 积分兑换至您的 PayPay 账户吗？」，
 *  确认后：扣减余额 → 新增一条「处理中」历史记录 → 成功提示 → 清空输入。
 */
async function confirmExchange() {
  if (!canExchange.value) return
  const n = amount.value
  submitting.value = true
  try {
  await ElMessageBox.confirm(
    t(apiEnabled ? 'backend.requestConfirm' : 'wallet.confirmText', { n: n.toLocaleString() }),
    t('wallet.confirmTitle'),
    {
      type: 'warning',
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
    },
  )
  } catch { submitting.value = false; return }
  try {
    if (apiEnabled) {
      await api('/wallet/redemptions', { method: 'POST', body: { amount: n }, key: requestKey.value })
      ElMessage.success(t('backend.requested'))
      amount.value = null
      await load()
    } else {
      balance.value -= n
      historyList.value.unshift({
        id: `ex_${Date.now()}`,
        time: new Date(),
        amount: n,
        status: 'processing',
        channel: 'PayPay',
      })
      amount.value = null
      ElMessage.success(t('wallet.success', { n: n.toLocaleString() }))
    }
  } catch (error) { ElMessage.error(error.message) }
  finally { submitting.value = false }
}

/** 历史记录时间格式化（随当前界面语言本地化） */
function fmtTime(d) {
  return new Date(d).toLocaleString(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
</script>

<template>
  <div class="wallet-page" v-loading="loading">
    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" />
    <el-button v-if="loadError" @click="load">{{ $t('backend.retry') }}</el-button>
    <!-- ============ 页头 ============ -->
    <header class="wallet-header">
      <div class="head-main">
        <el-icon class="head-icon"><Wallet /></el-icon>
        <div>
          <h1 class="head-title">{{ $t('wallet.title') }}</h1>
          <p class="head-desc">{{ $t(apiEnabled ? 'backend.requestHint' : 'wallet.desc') }}</p>
        </div>
      </div>
    </header>

    <!-- ============ 主体网格：A 资产总览 + B PayPay 兑换 ============ -->
    <div class="wallet-grid">
      <!-- ============ 区块 A：资产总览卡片 ============ -->
      <section class="overview-card">
        <div class="ov-label">{{ $t('wallet.balance') }}</div>
        <div class="ov-balance">
          <span class="ov-num">{{ balance.toLocaleString() }}</span>
          <span class="ov-unit">{{ $t('wallet.points') }}</span>
        </div>
        <!-- 汇率副标题：1 积分 = 1 日元 -->
        <div class="ov-sub">{{ $t('wallet.balanceSub') }}</div>

        <el-divider class="ov-divider" />

        <div class="ov-foot">
          <el-icon class="ov-foot-ic"><CreditCard /></el-icon>
          <span>{{ $t('wallet.minAmount') }}：{{ MIN_EXCHANGE.toLocaleString() }} {{ $t('wallet.points') }}</span>
        </div>
      </section>

      <!-- ============ 区块 B：PayPay 兑换表单 ============ -->
      <section class="exchange-card">
        <!-- 卡片头：PayPay 文字 Logo 占位 + 区块标题 -->
        <div class="ex-head">
          <div v-if="!apiEnabled" class="paypay-logo">PayPay</div>
          <span class="ex-title">{{ $t(apiEnabled ? 'backend.requests' : 'wallet.payPayTitle') }}</span>
        </div>

        <!-- B-1 账户绑定状态 -->
        <div v-if="!apiEnabled" class="bind-row">
          <template v-if="isPayPayBound">
            <!-- 已绑定：成功徽标 + 脱敏账号 -->
            <el-tag type="success" effect="light" round>
              {{ $t('wallet.bound') }}
            </el-tag>
            <span class="bind-account">
              {{ $t('wallet.boundAccount', { account: BOUNDED_ACCOUNT }) }}
            </span>
          </template>
          <template v-else>
            <!-- 未绑定：警告徽标 + 「去绑定 PayPay」按钮（1 秒模拟授权） -->
            <el-tag type="warning" effect="light" round>
              {{ $t('wallet.unbound') }}
            </el-tag>
            <el-button
              type="primary"
              size="small"
              :loading="binding"
              @click="bindPayPay"
            >
              <el-icon v-if="!binding" class="el-icon--left"><LinkIcon /></el-icon>
              {{ binding ? $t('wallet.binding') : $t('wallet.bindBtn') }}
            </el-button>
          </template>
        </div>

        <!-- B-2 兑换金额输入（步长 100） -->
        <div class="amount-row">
          <label class="amount-label">{{ $t('wallet.amountLabel') }}</label>
          <div class="amount-input-wrap">
            <el-input-number
              v-model="amount"
              :disabled="submitting"
              :step-strictly="apiEnabled"
              :step="100"
              :min="0"
              :precision="0"
              :controls-position="'right'"
              class="amount-input"
              :placeholder="$t('wallet.amountPh')"
            />
            <span class="amount-unit">{{ $t('wallet.points') }}</span>
          </div>
          <!-- 校验红字提示（低于 1000 / 超过余额时出现） -->
          <div v-if="amountError" class="field-error">{{ amountError }}</div>
        </div>

        <!-- B-3 确认兑换按钮（未绑定 / 金额不合法时禁用） -->
        <el-button
          type="primary"
          class="exchange-btn"
          :disabled="!canExchange"
          :loading="submitting"
          @click="confirmExchange"
        >
          {{ $t(apiEnabled ? 'backend.request' : 'wallet.exchangeBtn') }}
        </el-button>
      </section>
    </div>

    <!-- ============ 区块 C：兑换历史记录 ============ -->
    <section class="history-card">
      <h2 class="his-title">{{ $t('wallet.history') }}</h2>
      <el-table :data="historyList" stripe class="his-table">
        <el-table-column :label="$t('wallet.colTime')" min-width="170">
          <template #default="{ row }">{{ fmtTime(row.time) }}</template>
        </el-table-column>
        <el-table-column :label="$t('wallet.colAmount')" min-width="130">
          <template #default="{ row }">
            <b class="his-amount">{{ row.amount.toLocaleString() }}</b>
            <span class="his-unit">{{ $t('wallet.points') }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('wallet.colStatus')" min-width="110">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'done' ? 'success' : 'warning'"
              effect="light"
              round
            >
              {{
                apiEnabled ? $t('backend.' + row.status) : row.status === 'done'
                  ? $t('wallet.statusDone')
                  : $t('wallet.statusProcessing')
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('wallet.colChannel')" min-width="110">
          <template #default="{ row }">
            <span class="his-channel">{{ $t(apiEnabled ? 'backend.requestChannel' : 'wallet.channelPayPay') }}</span>
          </template>
        </el-table-column>
        <template #empty>
          <div class="his-empty">{{ $t('wallet.emptyHistory') }}</div>
        </template>
      </el-table>
    </section>
    <section v-if="apiEnabled" class="history-card">
      <h2 class="his-title">{{ $t('backend.ledger') }}</h2>
      <el-table :data="ledger" :empty-text="$t('backend.empty')">
        <el-table-column :label="$t('backend.time')"><template #default="{ row }">{{ fmtTime(row.created_at) }}</template></el-table-column>
        <el-table-column :label="$t('backend.actions')"><template #default="{ row }">{{ $t('backend.' + row.kind) }}</template></el-table-column>
        <el-table-column prop="amount" :label="$t('backend.amount')" />
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.wallet-page {
  padding: 24px 28px 40px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ---------- 页头 ---------- */
.wallet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head-main {
  display: flex;
  align-items: center;
  gap: 14px;
}
.head-icon {
  font-size: 34px;
  padding: 12px;
  border-radius: 14px;
  color: #4f46e5;
  background: #eef2ff;
}
.head-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.head-desc {
  font-size: 13px;
  color: #9ca3af;
  margin: 4px 0 0;
}

/* ---------- 主体网格 ---------- */
.wallet-grid {
  display: grid;
  grid-template-columns: minmax(280px, 5fr) minmax(340px, 7fr);
  gap: 18px;
  align-items: stretch;
}

/* ---------- 区块 A：资产总览 ---------- */
.overview-card {
  border-radius: 16px;
  padding: 26px 28px;
  color: #fff;
  background: linear-gradient(135deg, #4f46e5 0%, #7c6ff0 55%, #0d9488 130%);
  box-shadow: 0 14px 34px rgba(79, 70, 229, 0.28);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.ov-label {
  font-size: 13px;
  opacity: 0.85;
  letter-spacing: 1px;
}
.ov-balance {
  margin-top: 10px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.ov-num {
  font-size: 46px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}
.ov-unit {
  font-size: 15px;
  font-weight: 600;
  opacity: 0.9;
}
.ov-sub {
  margin-top: 10px;
  font-size: 12.5px;
  opacity: 0.8;
}
.ov-divider {
  margin: 20px 0 14px;
  border-color: rgba(255, 255, 255, 0.28);
}
.ov-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  opacity: 0.9;
}
.ov-foot-ic {
  font-size: 15px;
}

/* ---------- 区块 B：PayPay 兑换 ---------- */
.exchange-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.05);
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ex-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
/* PayPay 文字 Logo 占位（品牌绿底白字） */
.paypay-logo {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 10px;
  background: #00b26a;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.4px;
  user-select: none;
}
.ex-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

/* 绑定状态行 */
.bind-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8f9fc;
  border: 1px dashed #e5e7eb;
}
.bind-account {
  font-size: 13px;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
}

/* 金额输入行 */
.amount-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.amount-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.amount-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.amount-input {
  width: 240px;
}
.amount-unit {
  font-size: 13px;
  color: #6b7280;
}

/* 校验红字提示 */
.field-error {
  font-size: 12.5px;
  color: #f56c6c;
  line-height: 1.5;
}

/* 确认兑换按钮 */
.exchange-btn {
  width: 100%;
  height: 42px;
  font-size: 15px;
  font-weight: 600;
}

/* ---------- 区块 C：兑换历史记录 ---------- */
.history-card {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.05);
  padding: 20px 24px 24px;
}
.his-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 14px;
}
.his-amount {
  color: #111827;
  font-variant-numeric: tabular-nums;
}
.his-unit {
  margin-left: 6px;
  font-size: 12.5px;
  color: #9ca3af;
}
.his-channel {
  font-size: 13px;
  color: #4b5563;
  font-weight: 600;
}
.his-empty {
  padding: 18px 0;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
}

/* ---------- 小屏适配：单列堆叠 ---------- */
@media (max-width: 960px) {
  .wallet-page {
    padding: 16px 14px 28px;
  }
  .wallet-grid {
    grid-template-columns: 1fr;
  }
  .amount-input {
    width: 100%;
  }
}
</style>
