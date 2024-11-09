import {
  ITransitionPage,
  HooksTransitionMap,
  HooksTransition,
  Trigger,
} from '@barba/core/dist/src/defs'

function createResolver() {
  let resolver = null
  const promise = new Promise(resolve => (resolver = resolve))

  return { promise, resolver }
}

const { promise, resolver } = createResolver()

/**
 * @private
 * The key of the set of hooks that will run on next page shift
 */
let currentTransition: string | null = null

export const pageTransition = {
  finished: promise,
  resolver: resolver,
  done() {
    if (typeof this.resolver === 'function') {
      this.resolver()
    }

    const { promise, resolver } = createResolver()

    this.finished = promise
    this.resolver = resolver
  },
}

/**
 * @function useTransition
 * @description Used to trigger and run specific transitions not tied to specific routes (as is Barba default behavior).
 * @param {object} options - Options object
 * @param {object} options.page - An object where each key is a set of any Barba hooks
 * @param {object} options.global - A set of any Barba hooks
 * @param {object} options.barbaOptions - Any overwriting Barba options
 */
export default ({
  page,
  global,
}: {
  page: Record<string, HooksTransitionMap>
  global: HooksTransitionMap
}): ITransitionPage[] => {
  const runCurrentHook = async (hook: HooksTransition, data: unknown) => {
    if (window.innerWidth < 800) return

    const currentHooks = page[currentTransition]

    // no transition set, or the name doesn't exist
    if (!currentTransition || !currentHooks) {
      const [defaultTransition] = Object.keys(page)

      // run nothing if the default transition doesn't have current hook registered
      if (!page[defaultTransition][hook]) Promise.resolve()

      // run defaultTransition's hook
      return page[defaultTransition][hook](data)
    }

    // a currentTransition doesn't have currentHook registered
    if (typeof currentHooks[hook] !== 'function') {
      return Promise.resolve()
    }

    // currentTransition has currentHook registered, run it
    return currentHooks[hook](data)
  }

  const callGlobalHook = (hook: HooksTransition, data: unknown) => {
    if (typeof global[hook] !== 'function') return

    return global[hook](data)
  }

  // bug: chrome doesn't scroll to top if new page is prefetched and cached.
  function maybeScrollBackToTop(trigger: Trigger) {
    if (
      typeof trigger !== 'string' ||
      (trigger !== 'back' && trigger !== 'forward')
    ) {
      window.scrollTo(0, 0)
    }
  }

  const ALL_BARBA_HOOKS: HooksTransition[] = [
    'beforeOnce',
    'once',
    'afterOnce',
    'before',
    'beforeLeave',
    'leave',
    'afterLeave',
    'beforeEnter',
    'enter',
    'afterEnter',
    'after',
  ]

  const hooks = ALL_BARBA_HOOKS.reduce((acc, hook) => {
    return {
      ...acc,
      async [hook](data) {
        callGlobalHook(hook, data)
        await runCurrentHook(hook, data)
      },
    }
  }, {})

  return [
    {
      sync: false,
      name: 'main',
      ...hooks,
      async enter(data) {
        maybeScrollBackToTop(data.trigger)

        callGlobalHook('enter', data)
        await runCurrentHook('enter', data)

        // cleanup
        setTransition(null)
        data.next.container.removeAttribute('style')
        pageTransition.done()
      },
    },
  ]
}

export const setTransition = (name: string) => {
  currentTransition = name
}
