import { basePreset } from '../../tsup.config.base';

export default {
  ...basePreset,
  entry: ['src/index.ts', 'src/bin/tako.ts'],
};
