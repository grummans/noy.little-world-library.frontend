<script setup lang="ts">
// Renders the toast text; the view owns the message through useToast().
defineProps<{ message: string }>()
</script>

<template>
  <p v-if="message" class="toast" role="status">{{ message }}</p>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 80;
  margin: 0;
  background: #397653;
  color: #fff;
  font-family: "Nunito", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 700;
  padding: 12px 22px;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(34, 58, 43, 0.25);
}
</style>
