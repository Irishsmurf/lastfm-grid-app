// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
  },
};

export default config;
