// Composables
import { createRouter, createWebHistory, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import axios from 'axios'

const routes = [
  {
    path: '/',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/',
        name: 'Pipelines',
        // route level code-splitting
        // this generates a separate chunk (Pipeline-[hash].js) for this route
        // which is lazy-loaded when the route is visited.
        component: () => import('@/views/Pipeline.vue'),
      },
      {
        path: '/overview',
        name: 'Overview',
        meta: { requiresAdmin: true },
        component: () => import('@/views/Overview.vue'),
      },
      {
        path: '/pipeline/:pipeline',
        name: 'Pipeline Form',
        props: true,
        component: () => import('@/components/pipelines/form.vue'),
      },
      {
        path: '/pipeline/:pipeline/apps',
        name: 'Pipeline Apps',
        props: true,
        component: () => import('@/components/pipelines/detail.vue'),
      },
      {
        path: "/pipeline/:pipeline/:phase/apps/:app",
        name: "App Form",
        props: true,
        component: () => import('@/components/apps/form.vue'),
      },
      {
        path: "/pipeline/:pipeline/:phase/:app/detail",
        name: "App Dashboard",
        props: true,
        component: () => import('@/components/apps/detail.vue'),
      },
    ],
  },
  {
    path: '/profile',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
      },
    ],
  },
  {
    path: '/addons',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/addons',
        name: 'Addons',
        component: () => import('@/views/Addons.vue'),
      },
    ],
  },
  {
    path: '/activity',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/activity',
        name: 'Activity',
        meta: { requiredAnyPermissions: ['audit:read', 'audit:write'] },
        component: () => import('@/views/Activity.vue'),
      },
    ],
  },
  {
    path: '/templates',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/templates',
        name: 'Templates',
        component: () => import('@/views/Templates.vue'),
      },
    ],
  },
  {
    path: '/accounts',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/accounts',
        name: 'Accounts',
        component: () => import('@/views/Accounts.vue'),
      },
      {
        path: '/accounts/users',
        name: 'Account Users',
        meta: { accountSection: 'users', requiredAnyPermissions: ['user:read', 'user:write'] },
        component: () => import('@/views/Accounts.vue'),
      },
      {
        path: '/accounts/teams',
        name: 'Account Teams',
        meta: { accountSection: 'teams', requiredAnyPermissions: ['user:read', 'user:write'] },
        component: () => import('@/views/Accounts.vue'),
      },
      {
        path: '/accounts/roles',
        name: 'Account Roles',
        meta: { accountSection: 'roles', requiredAnyPermissions: ['user:read', 'user:write'], requiresUnscoped: true },
        component: () => import('@/views/Accounts.vue'),
      },
      {
        path: '/accounts/tokens',
        name: 'Account Tokens',
        meta: { accountSection: 'tokens', requiredAnyPermissions: ['token:read', 'token:write'] },
        component: () => import('@/views/Accounts.vue'),
      },
    ],
  },
  {
    path: '/settings',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/settings',
        name: 'Settings',
        meta: { requiredAnyPermissions: ['config:read', 'config:write'] },
        component: () => import('@/views/Settings.vue'),
      },
    ],
  },
  {
    path: '/runpacks',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/runpacks',
        name: 'Runpacks',
        meta: { requiredAnyPermissions: ['config:read', 'config:write'] },
        component: () => import('@/views/Runpacks.vue'),
      },
    ],
  },
  {
    path: '/podsizes',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/podsizes',
        name: 'Pod Sizes',
        meta: { requiredAnyPermissions: ['config:read', 'config:write'] },
        component: () => import('@/views/Podsizes.vue'),
      },
    ],
  },
  {
    path: '/notifications',
    component: () => import('@/layouts/default/Default.vue'),
    children: [
      {
        path: '/notifications',
        name: 'Notifications',
        meta: { requiredAnyPermissions: ['config:read', 'config:write'] },
        component: () => import('@/views/Notifications.vue'),
      },
    ],
  },
  {
    path: '/login',
    component: () => import('@/layouts/login/Login.vue'),
    children: [
      {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue'),
      },
    ],
  },
  {
    path: '/setup',
    component: () => import('@/layouts/setup/Setup.vue'),
    children: [
      {
        path: '/setup',
        name: 'Setup',
        component: () => import('@/views/Setup.vue'),
      },
    ],
  },
  {
    path: '/popup',
    component: () => import('@/layouts/default/Popup.vue'),
    children: [
      {
        path: '/popup/logs/:pipeline/:phase/:app/:deploymentstrategy/:buildstrategy',
        name: 'Pupup Logs',
        props: (route: RouteLocationNormalized) => ({
          ...route.params,
          hasAddons: route.query.hasAddons === 'true',
        }),
        component: () => import('@/components/apps/logs.vue'),
      },
      {
        path: '/popup/console/:pipeline/:phase/:app',
        name: 'Pupup Console',
        props: true,
        component: () => import('@/components/apps/console.vue'),
      }
    ],
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.name === 'Login' || to.name === 'Setup') return
  delete axios.defaults.headers.common['Authorization']
  await authStore.initialize()
  if (!authStore.userId) return { name: 'Login' }

  if (to.path === '/accounts') {
    if (authStore.hasPermission('user:read') || authStore.hasPermission('user:write')) return { name: 'Account Users' }
    if (authStore.hasPermission('token:read') || authStore.hasPermission('token:write')) return { name: 'Account Tokens' }
    return { name: 'Pipelines' }
  }

  if (to.meta.requiresAdmin && authStore.role !== 'admin') {
    return { name: 'Pipelines' }
  }

  // los roles son definiciones globales: un rol acotado a su propio equipo
  // no puede crear/editar/borrar ninguno, así que esta pantalla no le sirve
  if (to.meta.requiresUnscoped && authStore.scopeToOwnTeam) {
    return { name: 'Pipelines' }
  }

  const requiredAnyPermissions = to.meta.requiredAnyPermissions as string[] | undefined
  if (requiredAnyPermissions?.length && !requiredAnyPermissions.some((permission) => authStore.hasPermission(permission))) {
    return { name: 'Pipelines' }
  }
})
export default router
