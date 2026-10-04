// 注册 tests/ts-ext-resolver.mjs（详见该文件注释：加载期补 .ts 后缀）。
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(pathToFileURL('./tests/ts-ext-resolver.mjs'));
