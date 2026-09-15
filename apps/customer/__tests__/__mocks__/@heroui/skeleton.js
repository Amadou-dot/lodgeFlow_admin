const React = require('react');

module.exports = {
  Skeleton: function MockSkeleton({ className, style }) {
    return React.createElement('div', {
      className,
      style,
      'data-testid': 'skeleton',
    });
  },
};
