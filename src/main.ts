import './assets/styles/app.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createWebHistory } from 'vue-router'

import App from './App.vue'
import { createAppRouter } from './router'
import { useAppStore } from './stores/app'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(createAppRouter(createWebHistory(import.meta.env.BASE_URL)))

useAppStore(pinia).bootstrap()
void useAuthStore(pinia).initialize()

app.mount('#app')
