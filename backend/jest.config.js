module.exports = {
    testEnvironment: 'node',
    testTimeout: 30000,
    verbose: true,
    collectCoverageFrom: [
        'config/**/*.js',
        'middleware/**/*.js',
        'routes/**/*.js',
        'utils/**/*.js',
        'models/**/*.js',
        '!node_modules/**'
    ],
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov']
};
