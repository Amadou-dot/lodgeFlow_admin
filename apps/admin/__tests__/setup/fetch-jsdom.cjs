const { TestEnvironment } = require('jest-environment-jsdom');

// Keep real Node HTTP response parsing available to browser-hook tests.
class FetchJsdomEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    this.global.Response = Response;
  }
}

module.exports = FetchJsdomEnvironment;
