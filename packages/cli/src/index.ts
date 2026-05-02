import { Command } from 'commander';
import { registerIndexCommands } from './commands/index.ts';
import { registerRenderCommands } from './commands/render.ts';
import { registerSplitCommands } from './commands/split.ts';
import { registerConfigCommands } from './commands/config.ts';
import { registerPullDiffCommands } from './commands/pull-diff.ts';

const program = new Command('diffdeck');
program.version('1.0.0');

// 注册command
registerIndexCommands(program);
registerRenderCommands(program);
registerSplitCommands(program);
registerConfigCommands(program);
registerPullDiffCommands(program);

program.parse();