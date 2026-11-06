<template>
    <ThreeMonitorScene
        :key="activeScene"
        :kind="activeScene"
        :saved-state="states[activeScene]"
    />
    <nav class="scene-switch" aria-label="Scene">
        <button
            v-for="option in options"
            :key="option.kind"
            :aria-pressed="activeScene === option.kind"
            @click="activeScene = option.kind"
        >
            {{ option.label }}
        </button>
    </nav>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ThreeMonitorScene from "./three-monitor-scene.vue";

const activeScene = ref<"mesh" | "gsplat">("mesh");
const options = [
    { kind: "mesh", label: "glTF" },
    { kind: "gsplat", label: "3DGS" },
] as const;
// 保留各场景的标定和视角参数，切换时释放未使用场景的 GPU 资源
const states: Record<"mesh" | "gsplat", Record<string, any>> = {
    mesh: {},
    gsplat: {},
};
</script>

<style scoped>
.scene-switch {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    padding: 5px;
    border: 1px solid #555;
    border-radius: 12px;
    background: #111e;
    z-index: 1000;
}
button {
    border: 0;
    border-radius: 8px;
    padding: 10px 24px;
    background: transparent;
    color: #bbb;
    font: 600 14px system-ui;
    cursor: pointer;
}
button[aria-pressed="true"] {
    background: #fff;
    color: #111;
}
button:focus-visible {
    outline: 2px solid #aaa;
    outline-offset: 2px;
}
</style>
