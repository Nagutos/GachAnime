<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import ToastHost from '@/components/ToastHost.vue'
</script>

<template>
  <AppHeader />
  <RouterView />
  <ToastHost />
</template>
