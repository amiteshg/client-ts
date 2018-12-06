module.exports = {

    // enable code coverage analysis
    coverage: true,

    // set code coverage path
    coveragePath: "src",

    // code coverage threshold percentage
    threshold: 90,

    // enable linting
    lint: false,

    // verbose test output
    verbose: true,

    // file pattern to use for locating tests
    pattern: "test/*.test.ts",

    // javascript file that exports an array of objects ie.
    //  [{
    //    ext: ".js",
    //    transform: function (content, filename) { ... }
    //  }]
    transform: "node_modules/lab-transform-typescript",

    // ignore a list of globals for the leak detection (comma separated)
    globals: "__extends,__assign,__rest,__decorate,__param,__metadata," +
             "__awaiter,__generator,__exportStar,__values,__read,__spread," +
             "__await,__asyncGenerator,__asyncDelegator,__asyncValues," +
             "__makeTemplateObject,__importStar,__importDefault",

    // reporter type [console, html, json, tap, lcov, clover, junit]
    // Note that the order of entries corresponds to the `output` below
    reporter: ["console", "html"/*, "lcov"*/],

    // file path to write test results
    // Note that the order of entries corresponds to the `reporter` above
    output: ["stdout", "test/coverage.html"/*, "test/lcov.info"*/],

    // exit the process with a non zero exit code on the first test failure
    bail: false,                          
    
    // timeout for each test in milliseconds
    timeout: 3000,

    // timeout for before, after, beforeEach, afterEach in milliseconds
    contextTimeout: 1000,

    // --coverage-exclude              set code coverage excludes
    
    // include all files in coveragePath in report
    coverageAll: true,

    // prevent recursive inclusion of all files in coveragePath in report
    coverageFlat: false,

    // file pattern to use for locating files for coverage
    coveragePattern: "src/**.*",

    // -p, --default-plan-threshold    minimum plan threshold to apply to all tests that don't define any plan
    // -d, --dry                       skip all tests (dry run)
    
    // value to set NODE_ENV before tests
    environment: "test",
    
    // prevent recursive collection of tests within the provided path
    flat: true,

    // -g, --grep                      only run tests matching the given pattern which is internally compiled to a RegExp
    // -i, --id                        test identifier
    // --inspect                       starts lab with the node.js native debugger
    
    // disable global variable leaks detection
    leaks: true,

    // -n, --linter                    linter path to use
    // --lint-fix                      apply any fixes from the linter.
    // --lint-options                  specify options to pass to linting program. It must be a string that is JSON.parse(able).
    // --lint-errors-threshold         linter errors threshold in absolute value
    // --lint-warnings-threshold       linter warnings threshold in absolute value
    // --seed                          use this seed to randomize the order with `--shuffle`. This is useful to debug order dependent test failures
    
    // shuffle script execution order
    shuffle: false,
    
    // silence test output
    silence: false,
    
    // don’t output skipped tests
    silentSkips: false,

    // enable support for sourcemaps
    sourcemaps: true
};
