import { cac } from 'cac'
import { registerIndexCommands } from './commands/index.ts';
import { registerRenderCommands } from './commands/render.ts';
import { registerSplitCommands } from './commands/split.ts';
import { registerConfigCommands } from './commands/config.ts';
import { registerPullDiffCommands } from './commands/pull-diff.ts';

const cli = cac('diffdeck');

// 注册command
registerIndexCommands(cli);
registerRenderCommands(cli);
registerSplitCommands(cli);
registerConfigCommands(cli);
registerPullDiffCommands(cli);

cli.help();
cli.version('1.0.0');
cli.parse();