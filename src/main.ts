import './assets/styles/app.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createWebHistory } from 'vue-router'

import App from './App.vue'
import { initializeAppearance } from './composables/useAppearance'
import { createAppRouter } from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

initializeAppearance()
app.use(createAppRouter(createWebHistory(import.meta.env.BASE_URL)))

void useAuthStore(pinia).initialize()

app.mount('#app')
