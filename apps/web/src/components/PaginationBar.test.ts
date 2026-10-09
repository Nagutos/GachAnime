import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/app/i18n'
import PaginationBar from './PaginationBar.vue'

const mountBar = (page: number) =>
  mount(PaginationBar, {
    props: { page, pageSize: 10, total: 200 },
    global: { plugins: [i18n] },
  })

describe('PaginationBar', () => {
  it('turns a gap into a field that jumps to the typed page', async () => {
    const bar = mountBar(1)
    await bar.get('[data-testid="page-gap"]').trigger('click')
    const field = bar.get<HTMLInputElement>('[data-testid="page-jump"]')
    await field.setValue('12')
    await field.trigger('keydown', { key: 'Enter' })
    // Enter, then the blur of the removed field: a single jump.
    expect(bar.emitted('update:page')).toEqual([[12]])
    expect(bar.find('[data-testid="page-jump"]').exists()).toBe(false)
  })

  it('clamps the page typed in the phone field', async () => {
    const bar = mountBar(3)
    const field = bar.get<HTMLInputElement>('[data-testid="page-input"]')
    await field.setValue('500')
    await field.trigger('change')
    expect(bar.emitted('update:page')).toEqual([[20]])
  })
})
