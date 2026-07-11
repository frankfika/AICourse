"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js', 'json'],
    rootDir: 'src',
    testMatch: ['**/*.spec.ts'],
    moduleNameMapper: {
        '^@prisma/client$': '<rootDir>/../../../node_modules/@prisma/client',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    },
    setupFilesAfterEnv: [],
    coverageDirectory: '../coverage',
    collectCoverageFrom: ['**/*.service.ts'],
};
exports.default = config;
//# sourceMappingURL=jest.config.js.map