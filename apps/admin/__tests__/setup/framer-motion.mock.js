const React = require('react');

// Keep framer-motion's misc named exports, but replace everything that runs
// the real animation loop — under jsdom it recurses until the process OOMs.
const actual = jest.requireActual('framer-motion');

// framer-motion-only props stripped so React doesn't warn about unknown
// attributes on the plain DOM elements we render instead.
const MOTION_ONLY_PROPS = [
  'animate',
  'initial',
  'exit',
  'variants',
  'transition',
  'whileHover',
  'whileTap',
  'whileFocus',
  'whileDrag',
  'whileInView',
  'layout',
  'layoutId',
  'layoutDependency',
  'onAnimationStart',
  'onAnimationComplete',
  'onUpdate',
  'custom',
  'inherit',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
];

/** @param {string} tag */
function createMotionComponent(tag) {
  /**
   * @param {Record<string, unknown>} props
   * @param {import('react').ForwardedRef<Element>} ref
   */
  function MotionMock(props, ref) {
    const domProps = { ...props };
    for (const key of MOTION_ONLY_PROPS) delete domProps[key];
    return React.createElement(tag, { ...domProps, ref });
  }

  return React.forwardRef(MotionMock);
}

/** @type {Record<string, ReturnType<typeof createMotionComponent>>} */
const motionComponents = {};

// Render any motion.<tag> / m.<tag> as the plain HTML tag.
const motionProxy = new Proxy(motionComponents, {
  get: (target, prop) => {
    if (typeof prop !== 'string') return undefined;
    if (!target[prop]) target[prop] = createMotionComponent(prop);
    return target[prop];
  },
});

/** @typedef {{ children?: import('react').ReactNode }} MockChildrenProps */

module.exports = {
  ...actual,
  __esModule: true,
  AnimatePresence: /** @param {MockChildrenProps} props */ ({ children }) =>
    children,
  LazyMotion: /** @param {MockChildrenProps} props */ ({ children }) =>
    children,
  MotionConfig: /** @param {MockChildrenProps} props */ ({ children }) =>
    children,
  motion: motionProxy,
  m: motionProxy,
  domAnimation: {},
  domMax: {},
  useReducedMotion: () => true,
  useAnimation: () => ({ start: jest.fn(), stop: jest.fn(), set: jest.fn() }),
  animate: jest.fn(),
};
