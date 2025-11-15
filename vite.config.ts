import path from 'node:path';
import baseConfig from './estate-src/vite.config';
import type { UserConfig, ConfigEnv } from 'vite';

const estateRoot = path.resolve(__dirname, 'estate-src');
const estateOutDir = path.resolve(__dirname, 'estate');

if (process.cwd() !== estateRoot) {
  process.chdir(estateRoot);
}

function resolveBase(env: ConfigEnv): UserConfig {
  if (typeof baseConfig === 'function') {
    return baseConfig(env);
  }
  return baseConfig as UserConfig;
}

export default function defineMergedConfig(env: ConfigEnv): UserConfig {
  const resolved = resolveBase(env);
  return {
    ...resolved,
    root: estateRoot,
    build: {
      ...(resolved.build ?? {}),
      outDir: estateOutDir,
    },
  };
}
