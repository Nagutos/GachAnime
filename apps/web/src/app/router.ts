import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/boosters', name: 'boosters', component: () => import('@/pages/BoostersPage.vue') },
    {
      path: '/collection',
      name: 'collection',
      component: () => import('@/pages/CollectionPage.vue'),
    },
    {
      path: '/collection/series',
      name: 'collection-series',
      component: () => import('@/pages/CollectionSeriesPage.vue'),
    },
    { path: '/missions', name: 'missions', component: () => import('@/pages/MissionsPage.vue') },
    {
      path: '/achievements',
      name: 'achievements',
      component: () => import('@/pages/AchievementsPage.vue'),
    },
    { path: '/feedback', name: 'feedback', component: () => import('@/pages/FeedbackPage.vue') },
    { path: '/gems', name: 'gems', component: () => import('@/pages/GemsPage.vue') },
    { path: '/wiki', name: 'wiki', component: () => import('@/pages/WikiPage.vue') },
    {
      path: '/wiki/series/:id(\\d+)',
      name: 'wiki-series',
      component: () => import('@/pages/WikiSeriesPage.vue'),
      props: (route) => ({ id: Number(route.params.id) }),
    },
    {
      path: '/wiki/characters/:id(\\d+)',
      name: 'wiki-character',
      component: () => import('@/pages/WikiCharacterPage.vue'),
      props: (route) => ({ id: Number(route.params.id) }),
    },
    {
      // Lazy-loaded admin area; the server checks the role on every admin request anyway.
      path: '/admin',
      component: () => import('@/admin/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'admin',
          component: () => import('@/admin/pages/AdminDashboardPage.vue'),
        },
        {
          path: 'series',
          name: 'admin-series',
          component: () => import('@/admin/pages/AdminSeriesPage.vue'),
        },
        {
          path: 'series/:id(\\d+)',
          name: 'admin-series-detail',
          component: () => import('@/admin/pages/AdminSeriesDetailPage.vue'),
          props: (route) => ({ id: Number(route.params.id) }),
        },
        {
          path: 'characters',
          name: 'admin-characters',
          component: () => import('@/admin/pages/AdminCharactersPage.vue'),
        },
        {
          path: 'imports',
          name: 'admin-imports',
          component: () => import('@/admin/pages/AdminImportsPage.vue'),
        },
        {
          path: 'boosters',
          name: 'admin-boosters',
          component: () => import('@/admin/pages/AdminBoostersPage.vue'),
        },
        {
          path: 'rarities',
          name: 'admin-rarities',
          component: () => import('@/admin/pages/AdminRaritiesPage.vue'),
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('@/admin/pages/AdminSettingsPage.vue'),
        },
        {
          path: 'missions',
          name: 'admin-missions',
          component: () => import('@/admin/pages/AdminMissionsPage.vue'),
        },
        {
          path: 'achievements',
          name: 'admin-achievements',
          component: () => import('@/admin/pages/AdminAchievementsPage.vue'),
        },
        {
          path: 'feedback',
          name: 'admin-feedback',
          component: () => import('@/admin/pages/AdminFeedbackPage.vue'),
        },
        {
          path: 'audit',
          name: 'admin-audit',
          component: () => import('@/admin/pages/AdminAuditPage.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})
