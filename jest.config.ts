// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1', // Corrected: @/ refers to project root
    '^@lib/(.*)$': '<rootDir>/lib/$1', // This specific one is fine if @lib/ is used
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs', // Output CommonJS for Jest
          jsx: 'react-jsx',  // Use the new JSX transform. Overrides tsconfig.json's "jsx": "preserve" for tests.
                             // Ensures React is not expected to be in scope globally for JSX.
         },
        // No explicit babelConfig needed if ts-jest with react-jsx handles Next.js/React specific JSX correctly.
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!lucide-react)/"
    // Add other ESM modules from node_modules here if they cause similar issues
    // e.g., "/node_modules/(?!lucide-react|another-es-module)/"
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Added setup file
};

export default config;
