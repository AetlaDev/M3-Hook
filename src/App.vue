<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { autoInject, onVM, setTestUserOid } from './hook';
import { m3HookCleanup } from './lifecycle';
import { loadSettings, saveSettings } from './settings';

const STORAGE_KEY = 'm3-hook:state';

function loadOpen(): boolean {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as { open?: boolean };
    return parsed.open !== false;
  } catch {
    return true;
  }
}

const open = ref(loadOpen());
const vmReady = ref(false);
const autoCleanup = ref(loadSettings().autoCleanup);
const targetOid = ref('');

let targetOidTimer: number | undefined;

watch(targetOid, (value) => {
  window.clearTimeout(targetOidTimer);
  targetOidTimer = window.setTimeout(() => setTestUserOid(value), 500);
});

onMounted(() => {
  onVM(async (vm) => {
    vmReady.value = true;
    const injected = await autoInject(vm);
    if (injected && autoCleanup.value) m3HookCleanup();
  });
});

watch(open, () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: open.value }));
  } catch {}
});

function onAutoCleanupChange(event: Event): void {
  const checked = Boolean((event.target as HTMLElement & { checked?: boolean }).checked);
  autoCleanup.value = checked;
  saveSettings({ autoCleanup: checked });
}
</script>

<template>
  <m3e-theme class="m3-hook-theme" color="#6750A4" scheme="light" motion="expressive" strong-focus>
    <Transition name="m3-hook-pop">
      <section v-if="open" class="m3-hook-panel" aria-label="M3 Hook 面板">
        <header class="m3-hook-header">
          <div class="m3-hook-brand">
            <span class="m3-hook-logo"><m3e-icon name="bolt" filled></m3e-icon></span>
            <strong class="m3-hook-title">M3 Hook</strong>
          </div>
          <m3e-icon-button
            variant="standard"
            aria-label="收起面板"
            title="收起面板"
            @click="open = false"
          >
            <m3e-icon name="expand_more"></m3e-icon>
          </m3e-icon-button>
        </header>

        <div class="m3-hook-status">
          <m3e-icon v-if="vmReady" name="check_circle" filled></m3e-icon>
          <m3e-icon v-else class="m3-hook-spinner" name="progress_activity"></m3e-icon>
          <span>{{ vmReady ? '已加载完成' : '等待获取vm' }}</span>
        </div>

        <m3e-divider></m3e-divider>

        <div class="m3-hook-field">
          <span class="m3-hook-label">用户身份修改</span>
          <input
            v-model="targetOid"
            class="m3-hook-input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="请输入用户OID"
          />
        </div>

        <m3e-divider></m3e-divider>

        <div class="m3-hook-field">
          <span class="m3-hook-label">设置</span>
          <label class="m3-hook-setting">
            <span>注入成功后清除脚本</span>
            <m3e-switch :checked="autoCleanup" @change="onAutoCleanupChange"></m3e-switch>
          </label>
        </div>
      </section>
    </Transition>

    <Transition name="m3-hook-pop">
      <m3e-fab
        v-if="!open"
        class="m3-hook-fab"
        variant="primary"
        size="small"
        aria-label="展开 M3 Hook"
        title="展开 M3 Hook"
        @click="open = true"
      >
        <m3e-icon v-if="vmReady" name="bolt" filled></m3e-icon>
        <m3e-icon v-else class="m3-hook-spinner" name="progress_activity"></m3e-icon>
      </m3e-fab>
    </Transition>
  </m3e-theme>
</template>
