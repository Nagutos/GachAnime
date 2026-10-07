import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
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
